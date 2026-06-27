import { NextRequest, NextResponse } from "next/server";
import { AccountModel } from "@/lib/model";
import { encryptAttributes, decryptAttributes, decrypt } from "@/lib/crypto";
import { analyseStrength } from "@/lib/passwordStrength";
import { getSetting, SETTING_KEYS } from "@/lib/settings";
import { appendAuditLog } from "@/lib/auditLog";
import crypto from "crypto";

async function getRotationDays(): Promise<number> {
  try {
    const v = await getSetting(SETTING_KEYS.PASSWORD_ROTATION_DAYS, "90");
    return Math.max(1, parseInt(v, 10) || 90);
  } catch {
    return 90;
  }
}

function computeExpiryStatus(
  passwordLastChangedAt: Date | undefined,
  createdAt: Date,
  rotationDays: number
): { isExpired: boolean; isExpiringSoon: boolean; daysUntilExpiry: number | null } {
  const base = passwordLastChangedAt ?? createdAt;
  const now = Date.now();
  const daysSince = Math.floor((now - new Date(base).getTime()) / 86_400_000);
  const daysUntilExpiry = rotationDays - daysSince;
  return {
    isExpired: daysUntilExpiry <= 0,
    isExpiringSoon: daysUntilExpiry > 0 && daysUntilExpiry <= 14,
    daysUntilExpiry,
  };
}

/**
 * GET /api/accounts
 * Returns accounts (optionally filtered) with decrypted attributes and expiry info.
 */
export async function GET(request: NextRequest) {
  try {
    const rotationDays = await getRotationDays();
    const accounts = await AccountModel.findAll();

    const decrypted = await Promise.all(
      accounts.map(async (account) => {
        let decryptedHistory: unknown = undefined;
        if (account.passwordHistory) {
          decryptedHistory = await Promise.all(
            account.passwordHistory.map(async (h) => ({
              password: await decrypt(h.password),
              changedAt: h.changedAt,
            }))
          );
        }

        const expiry = computeExpiryStatus(
          account.passwordLastChangedAt,
          account.createdAt,
          rotationDays
        );

        return {
          ...account,
          _id: account._id?.toString(),
          attributes: await decryptAttributes(account.attributes),
          passwordHistory: decryptedHistory,
          ...expiry,
        };
      })
    );

    // Extract plaintext password for analysis
    const accountsWithPwd = decrypted.map((account) => {
      const attrs = account.attributes as Record<string, string | null>;
      let pwdPlain: string | null = null;
      let hasPasswordField = false;
      for (const k of ["Password", "password", "Pass", "pass"]) {
        if (k in attrs) {
          hasPasswordField = true;
          pwdPlain = attrs[k];
          break;
        }
      }
      return { account, pwdPlain, hasPasswordField };
    });

    // Detect duplicate passwords
    const pwdHashCount: Record<string, number> = {};
    const hashedAccounts = accountsWithPwd.map(({ account, pwdPlain, hasPasswordField }) => {
      let pwdHash: string | null = null;
      if (pwdPlain) {
        pwdHash = crypto.createHash("sha256").update(pwdPlain).digest("hex");
        pwdHashCount[pwdHash] = (pwdHashCount[pwdHash] ?? 0) + 1;
      }
      return { account, pwdPlain, pwdHash, hasPasswordField };
    });

    const url = new URL(request.url);
    const filter = url.searchParams.get("filter");
    const tagFilter = url.searchParams.get("tag");

    let filtered = hashedAccounts;

    if (filter === "weak") {
      filtered = hashedAccounts.filter(({ pwdPlain, hasPasswordField }) => {
        if (!hasPasswordField) return false;
        if (!pwdPlain) return true;
        const strength = analyseStrength(pwdPlain);
        return strength.label === "Weak" || strength.label === "Very Weak";
      });
    } else if (filter === "duplicate") {
      filtered = hashedAccounts.filter(({ pwdHash }) =>
        pwdHash ? pwdHashCount[pwdHash] > 1 : false
      );
    } else if (filter === "old") {
      filtered = hashedAccounts.filter(({ account }) => account.isExpired);
    } else if (filter === "favorites") {
      filtered = hashedAccounts.filter(({ account }) => account.isFavorite === true);
    } else if (filter === "expiring") {
      filtered = hashedAccounts.filter(({ account }) => account.isExpiringSoon || account.isExpired);
    }

    if (tagFilter) {
      filtered = filtered.filter(({ account }) =>
        Array.isArray(account.tags) && account.tags.includes(tagFilter)
      );
    }

    // Sort: favorites first, then alphabetically by serviceProvider
    const finalAccounts = filtered
      .map((f) => f.account)
      .sort((a, b) => {
        if (a.isFavorite && !b.isFavorite) return -1;
        if (!a.isFavorite && b.isFavorite) return 1;
        return (a.serviceProvider as string).localeCompare(b.serviceProvider as string);
      });

    // Group by serviceProvider
    const grouped: Record<string, typeof finalAccounts> = {};
    for (const account of finalAccounts) {
      const sp = account.serviceProvider as string;
      if (!grouped[sp]) grouped[sp] = [];
      grouped[sp].push(account);
    }

    return NextResponse.json({ accounts: finalAccounts, grouped });
  } catch (error) {
    console.error("GET /api/accounts error:", error);
    return NextResponse.json({ error: "Failed to fetch accounts" }, { status: 500 });
  }
}

/**
 * POST /api/accounts
 * Creates a new account entry with encrypted attributes.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { serviceProvider, attributes, tags } = body;

    if (!serviceProvider || typeof serviceProvider !== "string") {
      return NextResponse.json(
        { error: "serviceProvider is required and must be a string" },
        { status: 400 }
      );
    }

    if (!attributes || typeof attributes !== "object") {
      return NextResponse.json(
        { error: "attributes must be an object" },
        { status: 400 }
      );
    }

    const encryptedAttributes = await encryptAttributes(attributes);

    // Detect if any password field is present to set passwordLastChangedAt
    const hasPassword = Object.keys(attributes).some((k) =>
      ["password", "pass", "secret", "pin", "token", "key", "passcode"].some((p) =>
        k.toLowerCase().includes(p)
      )
    );

    const newAccount = await AccountModel.insertOne({
      serviceProvider,
      attributes: encryptedAttributes,
      tags: Array.isArray(tags) ? tags.map(String) : [],
      isFavorite: false,
      passwordLastChangedAt: hasPassword ? new Date() : undefined,
      source: "manual",
    });

    await appendAuditLog({
      action: "account.created",
      entity: "account",
      entityId: newAccount._id?.toString(),
      details: `Created account for ${serviceProvider}`,
      metadata: { serviceProvider, tags },
    });

    const rotationDays = await getRotationDays();
    const expiry = computeExpiryStatus(
      newAccount.passwordLastChangedAt,
      newAccount.createdAt,
      rotationDays
    );

    return NextResponse.json(
      {
        account: {
          ...newAccount,
          _id: newAccount._id?.toString(),
          attributes: await decryptAttributes(newAccount.attributes),
          ...expiry,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/accounts error:", error);
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
  }
}
