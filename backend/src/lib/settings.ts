/**
 * DB-backed settings store.
 * Reads from the `settings` collection in MongoDB.
 * Each setting is stored as { _id: key, value: string, updatedAt: Date }.
 *
 * JWT secret and AES key are stored exclusively in the DB — no .env fallback.
 * Other settings (e.g. password_rotation_days) may pass an envFallback
 * for first-run defaults.
 *
 * Uses a process-level in-memory cache so DB is not hit on every request.
 * Call `invalidateSetting(key)` after writing to force a fresh DB read.
 */

import { getDb } from "./db";

interface SettingDoc {
  _id: string;
  value: string;
  updatedAt: Date;
}

// Process-level cache: key → value
const cache: Map<string, string> = new Map();

/**
 * Read a setting from DB (or cache).
 * If missing, bootstraps from the provided envFallback and persists to DB.
 */
export async function getSetting(
  key: string,
  envFallback?: string
): Promise<string> {
  // Return cached value if present
  if (cache.has(key)) return cache.get(key)!;

  const db = await getDb();
  const doc = await db
    .collection<SettingDoc>("settings")
    .findOne({ _id: key } as never);

  if (doc?.value) {
    cache.set(key, doc.value);
    return doc.value;
  }

  // Bootstrap from env fallback and save to DB
  if (envFallback) {
    await setSetting(key, envFallback);
    return envFallback;
  }

  throw new Error(
    `Setting "${key}" not found in DB and no env fallback provided.`
  );
}

/**
 * Write (upsert) a setting to DB and update the cache.
 */
export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.collection<SettingDoc>("settings").updateOne(
    { _id: key } as never,
    { $set: { value, updatedAt: new Date() } },
    { upsert: true }
  );
  cache.set(key, value);
}

/**
 * Remove a setting from the in-memory cache, forcing a fresh DB read
 * on the next call to getSetting(). Call this after external writes.
 */
export function invalidateSetting(key: string): void {
  cache.delete(key);
}

/**
 * Read all settings as a key→value map (for the settings API).
 */
export async function getAllSettings(): Promise<Record<string, string>> {
  const db = await getDb();
  const docs = await db
    .collection<SettingDoc>("settings")
    .find({})
    .toArray();
  const result: Record<string, string> = {};
  for (const doc of docs) {
    result[doc._id] = doc.value;
  }
  return result;
}

// Well-known setting keys
export const SETTING_KEYS = {
  AES_KEY: "aes_encryption_key",
  JWT_SECRET: "jwt_secret",
  PASSWORD_ROTATION_DAYS: "password_rotation_days",
} as const;
