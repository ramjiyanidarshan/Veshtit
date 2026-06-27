import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSetting, SETTING_KEYS } from "@/lib/settings";
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

async function getAesKey(): Promise<Buffer> {
  const hex = await getSetting(SETTING_KEYS.AES_KEY);
  if (!hex || hex.length !== 64) throw new Error("AES key unavailable");
  return Buffer.from(hex, "hex");
}

function decryptWithKey(enc: string, key: Buffer): string {
  const parts = enc.split(":");
  if (parts.length !== 3) throw new Error("Not encrypted");
  const iv = Buffer.from(parts[0], "base64");
  const authTag = Buffer.from(parts[1], "base64");
  const ct = Buffer.from(parts[2], "base64");
  const d = crypto.createDecipheriv(ALGORITHM, key, iv);
  d.setAuthTag(authTag);
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
}

import { analyseStrength, type StrengthResult } from "@/lib/passwordStrength";

type SecurityLabel = "Critical" | "Poor" | "Fair" | "Good" | "Excellent";

function overallLabel(score: number): SecurityLabel {
  if (score >= 85) return "Excellent";
  if (score >= 65) return "Good";
  if (score >= 45) return "Fair";
  if (score >= 25) return "Poor";
  return "Critical";
}

/**
 * Check a single password against HaveIBeenPwned using k-anonymity.
 * Returns the breach count (0 = not breached).
 */
async function checkHibp(password: string): Promise<number> {
  const sha1 = crypto.createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return 0;

    const text = await res.text();
    for (const line of text.split("\n")) {
      const [lineSuffix, countStr] = line.trim().split(":");
      if (lineSuffix === suffix) {
        return parseInt(countStr, 10) || 0;
      }
    }
    return 0;
  } catch {
    clearTimeout(timeout);
    return 0;
  }
}

/**
 * GET /api/security/audit
 *
 * Decrypts all account passwords server-side, analyses them, and optionally
 * checks against HaveIBeenPwned via k-anonymity (plaintext never leaves server).
 */
export async function GET() {
  try {
    const db = await getDb();

    let rotationDays = 90;
    try {
      const v = await getSetting(SETTING_KEYS.PASSWORD_ROTATION_DAYS, "90");
      rotationDays = Math.max(1, parseInt(v, 10) || 90);
    } catch { /* use default */ }

    const key = await getAesKey();
    const now = Date.now();

    const accounts = await db
      .collection("accounts")
      .find({}, {
        projection: {
          serviceProvider: 1,
          attributes: 1,
          createdAt: 1,
          updatedAt: 1,
          passwordLastChangedAt: 1,
        },
      })
      .toArray();

    const breakdown = { veryWeak: 0, weak: 0, moderate: 0, strong: 0, veryStrong: 0 };
    const pwdHashCount: Record<string, number> = {};

    const accountResults = accounts
      .map((acc) => {
        const attrs = (acc.attributes ?? {}) as Record<string, string | null>;

        let pwdPlain: string | null = null;
        let hasPasswordField = false;
        for (const k of ["Password", "password", "Pass", "pass"]) {
          if (k in attrs) {
            hasPasswordField = true;
            const enc = attrs[k];
            if (enc) {
              try {
                pwdPlain = decryptWithKey(enc, key);
                break;
              } catch { /* skip */ }
            }
          }
        }

        if (!hasPasswordField) return null;

        const strength: StrengthResult = pwdPlain
          ? analyseStrength(pwdPlain)
          : { score: 0, label: "Very Weak", tips: ["No password found"] };

        if      (strength.label === "Very Strong") breakdown.veryStrong++;
        else if (strength.label === "Strong")      breakdown.strong++;
        else if (strength.label === "Moderate")    breakdown.moderate++;
        else if (strength.label === "Weak")        breakdown.weak++;
        else                                        breakdown.veryWeak++;

        let pwdHash: string | null = null;
        let sha1Hash: string | null = null;
        if (pwdPlain) {
          pwdHash = crypto.createHash("sha256").update(pwdPlain).digest("hex").slice(0, 16);
          sha1Hash = pwdPlain;
          pwdHashCount[pwdHash] = (pwdHashCount[pwdHash] ?? 0) + 1;
        }

        const base = acc.passwordLastChangedAt ?? acc.updatedAt ?? acc.createdAt;
        const lastUpdate = base ? new Date(base as Date).getTime() : null;
        const daysSinceUpdate = lastUpdate
          ? Math.floor((now - lastUpdate) / 86_400_000)
          : null;
        const needsRotation = daysSinceUpdate !== null && daysSinceUpdate >= rotationDays;

        let title: string | null = null;
        for (const k of ["Title", "title", "Label", "label"]) {
          if (attrs[k]) { title = attrs[k]; break; }
        }

        let emailPlain: string | null = null;
        for (const k of ["E-Mail", "Email", "email", "e-mail"]) {
          if (attrs[k]) {
            try { emailPlain = decryptWithKey(attrs[k]!, key); } catch { /* skip */ }
            break;
          }
        }

        return {
          _id: (acc._id as { toString(): string }).toString(),
          provider: (acc.serviceProvider as string) ?? "Unknown",
          title,
          score: strength.score,
          label: strength.label,
          tips: strength.tips,
          daysSinceUpdate,
          needsRotation,
          pwdHash,
          sha1Hash,
          email: emailPlain,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    // HIBP breach check (k-anonymity — only first 5 SHA-1 hex chars leave the server)
    // Run checks with a small concurrency limit to avoid rate-limiting
    const CONCURRENCY = 5;
    const breachCounts: number[] = new Array(accountResults.length).fill(0);
    let hibpAvailable = true;

    for (let i = 0; i < accountResults.length; i += CONCURRENCY) {
      const batch = accountResults.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (acc) => {
          if (!acc.sha1Hash) return 0;
          try {
            return await checkHibp(acc.sha1Hash);
          } catch {
            hibpAvailable = false;
            return 0;
          }
        })
      );
      results.forEach((count, j) => {
        breachCounts[i + j] = count;
        if (count === 0 && !accountResults[i + j].sha1Hash) {
          // no-op
        }
      });
    }

    const issues = accountResults.map(({ pwdHash, sha1Hash, email, ...rest }, idx) => ({
      ...rest,
      isDuplicate: pwdHash ? pwdHashCount[pwdHash] > 1 : false,
      isBreached: breachCounts[idx] > 0,
      breachCount: breachCounts[idx],
      email: email ?? undefined,
    }));

    const avgStrength = issues.length
      ? issues.reduce((s, a) => s + a.score, 0) / issues.length
      : 0;
    const rotationPenalty =
      (issues.filter((a) => a.needsRotation).length / Math.max(issues.length, 1)) * 20;
    const duplicatePenalty =
      (issues.filter((a) => a.isDuplicate).length / Math.max(issues.length, 1)) * 15;
    const breachPenalty =
      (issues.filter((a) => a.isBreached).length / Math.max(issues.length, 1)) * 25;
    const overallScore = Math.round(
      Math.max(0, Math.min(100, avgStrength - rotationPenalty - duplicatePenalty - breachPenalty))
    );

    issues.sort((a, b) => {
      const aRisk =
        (a.isBreached ? 50 : 0) +
        (a.needsRotation ? 30 : 0) +
        (a.isDuplicate ? 20 : 0) +
        (100 - a.score);
      const bRisk =
        (b.isBreached ? 50 : 0) +
        (b.needsRotation ? 30 : 0) +
        (b.isDuplicate ? 20 : 0) +
        (100 - b.score);
      return bRisk - aRisk;
    });

    return NextResponse.json({
      overallScore,
      scoreLabel: overallLabel(overallScore),
      rotationDays,
      hibpAvailable,
      summary: {
        total: issues.length,
        ...breakdown,
        needsRotation: issues.filter((a) => a.needsRotation).length,
        duplicates: issues.filter((a) => a.isDuplicate).length,
        breached: issues.filter((a) => a.isBreached).length,
      },
      issues: issues.slice(0, 20),
    });
  } catch (err) {
    console.error("Security audit error:", err);
    return NextResponse.json({ error: "Audit failed" }, { status: 500 });
  }
}
