import crypto from "crypto";
import { getSetting, SETTING_KEYS } from "./settings";

const ALGORITHM = "aes-256-gcm";

/**
 * Resolves the AES-256-GCM key from DB (falls back to .env on first run).
 */
async function resolveKey(): Promise<Buffer> {
  const hex = await getSetting(
    SETTING_KEYS.AES_KEY,
    process.env.AES_ENCRYPTION_KEY
  );
  if (!hex || hex.length !== 64) {
    throw new Error(
      "AES encryption key must be a 64-character hex string (32 bytes)."
    );
  }
  return Buffer.from(hex, "hex");
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns: `iv:authTag:ciphertext` (all base64).
 */
export async function encrypt(plaintext: string): Promise<string> {
  const key = await resolveKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

/**
 * Decrypts a string produced by `encrypt()`.
 */
export async function decrypt(encryptedString: string): Promise<string> {
  const key = await resolveKey();
  const parts = encryptedString.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted string format");
  }

  const [ivB64, authTagB64, ciphertextB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Checks if an attribute key indicates sensitive data that should be encrypted.
 */
export function isSensitiveAttribute(key: string): boolean {
  const k = key.toLowerCase();
  return (
    k.includes("password") ||
    k.includes("pin") ||
    k.includes("secret") ||
    k.includes("token") ||
    k.includes("key") ||
    k.includes("passcode")
  );
}

/**
 * Encrypts only sensitive values in an attributes map.
 * Non-sensitive values are stored as plaintext.
 */
export async function encryptAttributes(
  attributes: Record<string, string | null>
): Promise<Record<string, string | null>> {
  const result: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(attributes)) {
    if (v === null) {
      result[k] = null;
    } else if (isSensitiveAttribute(k)) {
      result[k] = await encrypt(v);
    } else {
      result[k] = v; // plaintext for searchability
    }
  }
  return result;
}

/**
 * Decrypts values in an attributes map.
 * Safely ignores and returns plaintext fields.
 */
export async function decryptAttributes(
  attributes: Record<string, string | null>
): Promise<Record<string, string | null>> {
  const result: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(attributes)) {
    if (v === null) {
      result[k] = null;
      continue;
    }
    
    // Fast path: if it doesn't match the `iv:authTag:ciphertext` format, it's plaintext
    const parts = v.split(":");
    if (parts.length !== 3 || parts[0].length !== 16 || parts[1].length !== 24) {
      result[k] = v;
      continue;
    }

    try {
      result[k] = await decrypt(v);
    } catch {
      result[k] = v; // fallback to plaintext just in case
    }
  }
  return result;
}

/**
 * Re-encrypts all attributes from oldKey → newKey.
 * Used when rotating the AES key.
 */
export async function reEncryptAttributes(
  attributes: Record<string, string | null>,
  oldKeyHex: string,
  newKeyHex: string
): Promise<Record<string, string | null>> {
  const oldKey = Buffer.from(oldKeyHex, "hex");
  const newKey = Buffer.from(newKeyHex, "hex");
  const result: Record<string, string | null> = {};

  for (const [k, v] of Object.entries(attributes)) {
    if (v === null) { result[k] = null; continue; }
    try {
      // Decrypt with old key
      const parts = v.split(":");
      if (parts.length !== 3) { result[k] = v; continue; }
      const [ivB64, authTagB64, ciphertextB64] = parts;
      const iv = Buffer.from(ivB64, "base64");
      const authTag = Buffer.from(authTagB64, "base64");
      const ciphertext = Buffer.from(ciphertextB64, "base64");
      const decipher = crypto.createDecipheriv(ALGORITHM, oldKey, iv);
      decipher.setAuthTag(authTag);
      const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");

      // Re-encrypt with new key
      const newIv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv(ALGORITHM, newKey, newIv);
      const newCiphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
      const newAuthTag = cipher.getAuthTag();
      result[k] = [newIv.toString("base64"), newAuthTag.toString("base64"), newCiphertext.toString("base64")].join(":");
    } catch {
      result[k] = v;
    }
  }

  return result;
}
