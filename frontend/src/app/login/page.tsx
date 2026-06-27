"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { authApi, ApiError } from "@/lib/api";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [tempToken, setTempToken] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const router = useRouter();

  useEffect(() => {
    authApi.verify()
      .then(() => router.replace("/accounts"))
      .catch(() => setChecking(false));
  }, [router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (mfaRequired) {
        await authApi.verifyMfa(tempToken, mfaCode);
        router.push("/");
      } else {
        const res = await authApi.login(username, password);
        if (res.mfaRequired && res.tempToken) {
          setMfaRequired(true);
          setTempToken(res.tempToken);
        } else {
          router.push("/");
        }
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.status === 401
            ? "Invalid credentials"
            : "Login failed. Please try again."
        );
      } else {
        setError("Cannot connect to the server. Make sure the backend is running.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  if (checking) return null;

  return (
    <div className="login-page">
      {/* Background orbs */}
      <div className="login-bg-orb login-bg-orb-1" />
      <div className="login-bg-orb login-bg-orb-2" />

      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon" style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-primary)" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <div>
            <div className="login-title">Veshtit</div>
            <div className="login-subtitle">Digital Account Manager</div>
          </div>
        </div>

        <form className="login-form" onSubmit={handleLogin}>
          {error && <div className="login-error" id="login-error">{error}</div>}

          {!mfaRequired ? (
            <>
              <div className="form-group">
                <label className="form-label" htmlFor="login-username">
                  Username
                </label>
                <input
                  id="login-username"
                  type="text"
                  className="form-input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  autoComplete="username"
                  autoFocus
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="login-password">
                  Password
                </label>
                <input
                  id="login-password"
                  type="password"
                  className="form-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
              </div>
            </>
          ) : (
            <div className="form-group">
              <label className="form-label" htmlFor="login-mfa">
                Authenticator Code
              </label>
              <input
                id="login-mfa"
                type="text"
                className="form-input"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                placeholder="Enter 6-digit code"
                autoComplete="one-time-code"
                autoFocus
                required
              />
            </div>
          )}

          <button
            id="login-submit"
            type="submit"
            className="btn btn-primary btn-lg w-full"
            disabled={isLoading}
            style={{ marginTop: "0.5rem" }}
          >
            {isLoading ? (
              <>
                <svg
                  className="spin"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                {mfaRequired ? "Verifying..." : "Signing in..."}
              </>
            ) : (
              mfaRequired ? "Verify Code" : "Sign In"
            )}
          </button>
        </form>

        <div
          style={{
            marginTop: "1.5rem",
            padding: "0.75rem",
            background: "var(--bg-tertiary)",
            borderRadius: "var(--radius-md)",
            fontSize: "0.75rem",
            color: "var(--text-muted)",
            textAlign: "center",
            lineHeight: 1.6,
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", justifyContent: "center" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            All account data is AES-256-GCM encrypted at rest.
          </span>
        </div>
      </div>
    </div>
  );
}
