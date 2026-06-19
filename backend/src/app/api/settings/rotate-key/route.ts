import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import crypto from "crypto";
import { getSetting, setSetting, invalidateSetting, SETTING_KEYS } from "@/lib/settings";

const ALGORITHM = "aes-256-gcm";

function decryptWithKey(encryptedString: string, key: Buffer): string {
  const parts = encryptedString.split(":");
  if (parts.length !== 3) throw new Error("Not encrypted");
  const [ivB64, authTagB64, ciphertextB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

function encryptWithKey(plaintext: string, key: Buffer): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(":");
}

/**
 * POST /api/settings/rotate-key
 * Body: { newKey: string }   (64-char hex)
 *
 * Returns a text/event-stream SSE response so the frontend can show
 * live re-encryption progress.
 *
 * SSE event shapes:
 *   data: { type: "start",    total: N }
 *   data: { type: "progress", done: N, total: N }
 *   data: { type: "done",     reEncrypted: N }
 *   data: { type: "error",    message: string }
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { newKey } = body as { newKey?: string };

  if (!newKey || newKey.length !== 64 || !/^[0-9a-fA-F]+$/.test(newKey)) {
    return NextResponse.json(
      { error: "AES key must be a 64-character hex string." },
      { status: 400 }
    );
  }

  let oldKeyHex: string;
  try {
    oldKeyHex = await getSetting(SETTING_KEYS.AES_KEY);
  } catch {
    return NextResponse.json({ error: "No current AES key found in database." }, { status: 500 });
  }

  if (oldKeyHex === newKey) {
    const stream = new ReadableStream({
      start(ctrl) {
        const enc = new TextEncoder();
        ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ type: "done", reEncrypted: 0, message: "Key unchanged." })}\n\n`));
        ctrl.close();
      },
    });
    return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
  }

  const oldKey = Buffer.from(oldKeyHex, "hex");
  const newKeyBuf = Buffer.from(newKey, "hex");

  // Build the SSE stream
  const encoder = new TextEncoder();
  let streamController!: ReadableStreamDefaultController<Uint8Array>;

  function send(data: object) {
    try {
      streamController.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    } catch { /* stream closed */ }
  }

  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      streamController = ctrl;
    },
    cancel() { /* client disconnected */ },
  });

  // Run re-encryption in the background (after returning the stream)
  (async () => {
    try {
      const db = await getDb();
      const col = db.collection("accounts");
      const accounts = await col.find({}).toArray();
      const total = accounts.length;

      send({ type: "start", total });

      let reEncrypted = 0;
      for (let i = 0; i < accounts.length; i++) {
        const account = accounts[i];
        const oldAttrs = account.attributes as Record<string, string | null>;
        const newAttrs: Record<string, string | null> = {};

        for (const [k, v] of Object.entries(oldAttrs)) {
          if (!v) { newAttrs[k] = v; continue; }
          try {
            const plaintext = decryptWithKey(v, oldKey);
            newAttrs[k] = encryptWithKey(plaintext, newKeyBuf);
          } catch {
            newAttrs[k] = v; // leave untouched if not encrypted
          }
        }

        let newHistory: any = undefined;
        if (account.passwordHistory && Array.isArray(account.passwordHistory)) {
          newHistory = [];
          for (const h of account.passwordHistory) {
            try {
              const plaintext = decryptWithKey(h.password, oldKey);
              newHistory.push({
                password: encryptWithKey(plaintext, newKeyBuf),
                changedAt: h.changedAt,
              });
            } catch {
              newHistory.push(h);
            }
          }
        }

        const setFields: any = { attributes: newAttrs, updatedAt: new Date() };
        if (newHistory !== undefined) {
          setFields.passwordHistory = newHistory;
        }

        await col.updateOne(
          { _id: account._id },
          { $set: setFields }
        );
        reEncrypted++;
        send({ type: "progress", done: reEncrypted, total });
      }

      // Save new key to DB
      await setSetting(SETTING_KEYS.AES_KEY, newKey);
      invalidateSetting(SETTING_KEYS.AES_KEY);

      send({ type: "done", reEncrypted });
      streamController.close();
    } catch (err) {
      send({ type: "error", message: err instanceof Error ? err.message : String(err) });
      streamController.close();
    }
  })();

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
