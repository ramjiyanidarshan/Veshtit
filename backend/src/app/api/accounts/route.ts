import { NextRequest, NextResponse } from "next/server";
import { AccountModel } from "@/lib/model";
import { encryptAttributes, decryptAttributes, decrypt } from "@/lib/crypto";
import { analyseStrength } from "@/lib/passwordStrength";
import { getSetting, SETTING_KEYS } from "@/lib/settings";
import crypto from "crypto";

/**
 * GET /api/accounts
 * Returns accounts (optionally filtered by weak, duplicate, or old passwords) with decrypted attributes.
 */
export async function GET(request: NextRequest) {
  try {
    const accounts = await AccountModel.findAll();

    const decrypted = await Promise.all(
      accounts.map(async (account) => {
        let decryptedHistory: any = undefined;
        if (account.passwordHistory) {
          decryptedHistory = await Promise.all(
            account.passwordHistory.map(async (h) => ({
              password: await decrypt(h.password),
              changedAt: h.changedAt,
            }))
          );
        }

        return {
          ...account,
          _id: account._id?.toString(),
          attributes: await decryptAttributes(account.attributes),
          passwordHistory: decryptedHistory,
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
      return {
        account,
        pwdPlain,
        hasPasswordField,
      };
    });

    // Detect duplicate passwords (hash-based, same as in security audit)
    const pwdHashCount: Record<string, number> = {};
    const hashedAccounts = accountsWithPwd.map(({ account, pwdPlain, hasPasswordField }) => {
      let pwdHash: string | null = null;
      if (pwdPlain) {
        pwdHash = crypto.createHash("sha256").update(pwdPlain).digest("hex");
        pwdHashCount[pwdHash] = (pwdHashCount[pwdHash] ?? 0) + 1;
      }
      return {
        account,
        pwdPlain,
        pwdHash,
        hasPasswordField,
      };
    });

    const url = new URL(request.url);
    const filter = url.searchParams.get("filter");

    let filtered = hashedAccounts;

    if (filter === "weak") {
      filtered = hashedAccounts.filter(({ pwdPlain, hasPasswordField }) => {
        if (!hasPasswordField) return false;
        if (!pwdPlain) return true; // Treat empty password field as weak
        const strength = analyseStrength(pwdPlain);
        return strength.label === "Weak" || strength.label === "Very Weak";
      });
    } else if (filter === "duplicate") {
      filtered = hashedAccounts.filter(({ pwdHash }) => {
        return pwdHash ? pwdHashCount[pwdHash] > 1 : false;
      });
    } else if (filter === "old") {
      let rotationDays = 90;
      try {
        const v = await getSetting(SETTING_KEYS.PASSWORD_ROTATION_DAYS, "90");
        rotationDays = Math.max(1, parseInt(v, 10) || 90);
      } catch { /* use default */ }
      const now = Date.now();

      filtered = hashedAccounts.filter(({ account }) => {
        const lastUpdate = account.updatedAt
          ? new Date(account.updatedAt).getTime()
          : account.createdAt ? new Date(account.createdAt).getTime() : null;
        const daysSinceUpdate = lastUpdate ? Math.floor((now - lastUpdate) / 86_400_000) : null;
        return daysSinceUpdate !== null && daysSinceUpdate >= rotationDays;
      });
    }

    const finalAccounts = filtered.map((f) => f.account);

    // Group by serviceProvider
    const grouped: Record<string, typeof finalAccounts> = {};
    for (const account of finalAccounts) {
      if (!grouped[account.serviceProvider]) {
        grouped[account.serviceProvider] = [];
      }
      grouped[account.serviceProvider].push(account);
    }

    return NextResponse.json({ accounts: finalAccounts, grouped });
  } catch (error) {
    console.error("GET /api/accounts error:", error);
    return NextResponse.json(
      { error: "Failed to fetch accounts" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/accounts
 * Creates a new account entry with encrypted attributes.
 *
 * Body: { serviceProvider: string, attributes: Record<string, string | null> }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { serviceProvider, attributes } = body;

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

    const newAccount = await AccountModel.insertOne({
      serviceProvider,
      attributes: encryptedAttributes,
      source: "manual",
    });

    const sessionId = request.headers.get("x-session-id");
    if (sessionId) {
      const { appendAuditEntry } = await import("@/lib/session");
      await appendAuditEntry(
        sessionId,
        "account.created",
        `Created account for ${serviceProvider}`
      );
    }

    return NextResponse.json(
      {
        account: {
          ...newAccount,
          _id: newAccount._id?.toString(),
          attributes: await decryptAttributes(newAccount.attributes),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/accounts error:", error);
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
  }
}
