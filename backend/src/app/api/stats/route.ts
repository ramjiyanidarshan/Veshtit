import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSetting, SETTING_KEYS } from "@/lib/settings";
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

/**
 * Decrypt a single attribute value using the AES key stored in the settings
 * collection (DB-only, no env fallback).
 *
 * Inlined here (instead of importing from @/lib/crypto) so that the stats
 * route is completely self-contained and immune to HMR / module-cache issues.
 */
async function decryptValue(encryptedString: string): Promise<string> {
  const hexKey = await getSetting(SETTING_KEYS.AES_KEY);
  if (!hexKey || hexKey.length !== 64) {
    throw new Error("AES key not available");
  }

  const key = Buffer.from(hexKey, "hex");
  const parts = encryptedString.split(":");
  if (parts.length !== 3) throw new Error("Not AES-GCM format");

  const [ivB64, authTagB64, ciphertextB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}

/**
 * GET /api/stats
 * Decrypts attributes.Status per account in JS (MongoDB can't decrypt AES-256-GCM).
 */
export async function GET() {
  try {
    const db = await getDb();
    const col = db.collection("accounts");

    // Fetch all accounts — only fields needed
    const allDocs = await col
      .find({}, { projection: { serviceProvider: 1, attributes: 1, createdAt: 1 } })
      .toArray();

    const totalAccounts = allDocs.length;

    // ── Status breakdown ──────────────────────────────────────────────────────
    const statusBreakdown: Record<string, number> = { Active: 0, Disable: 0, Deleted: 0, Other: 0 };

    for (const doc of allDocs) {
      let status = "Other";
      const rawStatus = (doc.attributes as Record<string, string | null>)?.Status ?? null;

      if (rawStatus) {
        // Fast path: if it doesn't match the `iv:authTag:ciphertext` format, it's already plaintext
        const parts = rawStatus.split(":");
        let plaintext = rawStatus;

        if (parts.length === 3 && parts[0].length === 16 && parts[1].length === 24) {
          try {
            plaintext = await decryptValue(rawStatus);
          } catch {
            plaintext = "Other";
          }
        }

        if (["Active", "Disable", "Deleted"].includes(plaintext)) {
          status = plaintext;
        }
      }

      if (status === "Active") statusBreakdown.Active++;
      else if (status === "Disable") statusBreakdown.Disable++;
      else if (status === "Deleted") statusBreakdown.Deleted++;
      else statusBreakdown.Other++;
    }

    // ── Provider stats ────────────────────────────────────────────────────────
    const providerCounts: Record<string, number> = {};
    for (const doc of allDocs) {
      const sp = (doc.serviceProvider as string) ?? "Unknown";
      providerCounts[sp] = (providerCounts[sp] ?? 0) + 1;
    }

    const totalProviders = Object.keys(providerCounts).length;
    const topProviders = Object.entries(providerCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));

    // ── Recent accounts — last 5, with decrypted status ───────────────────────
    const recentDocs = [...allDocs]
      .sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt as Date).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt as Date).getTime() : 0;
        return tb - ta;
      })
      .slice(0, 5);

    const recentAccounts = await Promise.all(
      recentDocs.map(async (a) => {
        const rawStatus = (a.attributes as Record<string, string | null>)?.Status ?? null;
        let status = "Active"; // sensible default for display

        if (rawStatus) {
          const parts = rawStatus.split(":");
          let plaintext = rawStatus;

          if (parts.length === 3 && parts[0].length === 16 && parts[1].length === 24) {
            try {
              plaintext = await decryptValue(rawStatus);
            } catch {
              plaintext = "Active";
            }
          }

          if (["Active", "Disable", "Deleted"].includes(plaintext)) {
            status = plaintext;
          }
        }

        return {
          _id: (a._id as { toString(): string }).toString(),
          serviceProvider: a.serviceProvider as string,
          status,
          source: (a.source as string | undefined) ?? "manual",
          createdAt: a.createdAt ?? null,
          updatedAt: a.updatedAt ?? null,
        };
      })
    );

    return NextResponse.json({
      totalAccounts,
      totalProviders,
      statusBreakdown,
      topProviders,
      recentAccounts,
    });
  } catch (err) {
    console.error("Stats error:", err);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
