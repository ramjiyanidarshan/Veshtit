import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

export const COOKIE_NAME = "veshtit_token";
const TOKEN_EXPIRY = "7d";

// ── In-process JWT secret cache ────────────────────────────────────────────
// Populated on first call to loadJwtSecret() from any API route.
// proxy.ts (edge middleware) reads this synchronously.
// When the secret is rotated, invalidateJwtCache() clears it so the next
// route-handler call will reload from DB.

let _cachedSecret: string | null = null;

/**
 * Returns the cached JWT secret (may be null if not yet loaded).
 * Used by proxy.ts synchronously.
 */
export function getJwtSecretSync(): string | null {
  return _cachedSecret;
}

/**
 * Loads the JWT secret from DB, caches it, and returns it.
 * If no secret exists in the DB yet (first run after migration from env),
 * generates a cryptographically secure random one and persists it.
 */
export async function loadJwtSecret(): Promise<string> {
  if (_cachedSecret) return _cachedSecret;

  // Lazy import to avoid importing DB code in edge middleware
  const { getSetting, setSetting, SETTING_KEYS } = await import("./settings");

  let secret: string;
  try {
    secret = await getSetting(SETTING_KEYS.JWT_SECRET);
  } catch {
    // Not in DB yet — generate a fresh secret and persist it permanently
    const { randomBytes } = await import("crypto");
    secret = randomBytes(64).toString("hex");
    await setSetting(SETTING_KEYS.JWT_SECRET, secret);
    console.warn(
      "[Veshtit] JWT secret was not in DB — generated and stored a new one. " +
      "Any existing login sessions are now invalid; please log in again."
    );
  }

  _cachedSecret = secret;
  return secret;
}

/**
 * Clears the in-process cache so the next call to loadJwtSecret() reads from DB.
 * Call after rotating the JWT secret.
 */
export function invalidateJwtCache(): void {
  _cachedSecret = null;
}

export interface JwtPayload {
  username: string;
  mfaPending?: boolean;
  iat?: number;
  exp?: number;
}

/**
 * Signs a JWT token. Loads the secret from DB if not cached.
 */
export async function signToken(
  payload: Omit<JwtPayload, "iat" | "exp">
): Promise<string> {
  const secret = await loadJwtSecret();
  return jwt.sign(payload, secret, { expiresIn: TOKEN_EXPIRY });
}

/**
 * Signs a short-lived temporary token for MFA verification.
 */
export async function signTempToken(
  payload: Omit<JwtPayload, "iat" | "exp">
): Promise<string> {
  const secret = await loadJwtSecret();
  return jwt.sign(payload, secret, { expiresIn: "5m" });
}

/**
 * Verifies a JWT token. Loads the secret from DB if not already cached.
 * Returns the payload on success, null on failure.
 */
export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const secret = await loadJwtSecret();
    return jwt.verify(token, secret) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Reads the auth token from request cookies (Next.js server context).
 */
export async function getTokenFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  return cookie?.value ?? null;
}

/**
 * Builds a Set-Cookie header that sets the auth cookie.
 */
export function buildAuthCookieHeader(token: string): string {
  const maxAge = 7 * 24 * 60 * 60;
  return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=None; Secure; Max-Age=${maxAge}; Path=/`;
}

/**
 * Builds a Set-Cookie header that clears the auth cookie.
 */
export function buildClearCookieHeader(): string {
  return `${COOKIE_NAME}=; HttpOnly; SameSite=None; Secure; Max-Age=0; Path=/`;
}
