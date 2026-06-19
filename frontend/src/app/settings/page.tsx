"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { settingsApi } from "@/lib/api";
import { useTheme } from "@/context/ThemeContext";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

interface Settings {
  security: { username: string; mfaEnabled?: boolean };
  encryption: { keyMasked: string; algorithm: string };
  jwt: { secretMasked: string };
  database: { uriMasked: string; status: "connected" | "error"; latencyMs: number | null };
  policy: { passwordRotationDays: number };
  generator?: { length: number; uppercase: boolean; lowercase: boolean; numbers: boolean; symbols: boolean };
}

type SectionKey = "security" | "encryption" | "jwt" | "database" | "appearance" | "data";
type Msg = { type: "success" | "error" | "warning"; text: string } | null;

function Alert({ msg }: { msg: Msg }) {
  if (!msg) return null;
  const colors = {
    success: { bg: "rgba(74,222,128,0.1)", color: "#4ade80", border: "rgba(74,222,128,0.25)" },
    error: { bg: "rgba(244,63,94,0.1)", color: "#f43f5e", border: "rgba(244,63,94,0.25)" },
    warning: { bg: "rgba(251,191,36,0.1)", color: "#fbbf24", border: "rgba(251,191,36,0.25)" },
  }[msg.type];
  const icons = {
    success: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>,
    warning: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>,
    error: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>,
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", padding: "0.875rem 1rem", borderRadius: "var(--radius-lg)", background: colors.bg, color: colors.color, border: `1px solid ${colors.border}`, fontSize: "0.875rem", marginBottom: "1rem" }}>
      {icons[msg.type]} {msg.text}
    </div>
  );
}

function Spinner() {
  return <svg className="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>;
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "var(--bg-glass)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      border: "1px solid var(--border-subtle)",
      borderRadius: "var(--radius-xl)",
      padding: "1.75rem",
      boxShadow: "var(--shadow-md)",
      transition: "border-color 0.2s, box-shadow 0.2s",
      ...style,
    }}>
      {children}
    </div>
  );
}

function CardHeader({ icon, title, subtitle, badge }: { icon: string; title: string; subtitle: string; badge?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
      <div style={{ width: 40, height: 40, borderRadius: "var(--radius-md)", background: "var(--bg-hover)", border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)" }}>{title}</h3>
        <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.125rem" }}>{subtitle}</p>
      </div>
      {badge}
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<SectionKey>("security");

  const [pwForm, setPwForm] = useState({ current: "", newPwd: "", confirm: "" });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState<Msg>(null);

  const [rotationDays, setRotationDays] = useState(90);
  const [rotationLoading, setRotationLoading] = useState(false);
  const [rotationMsg, setRotationMsg] = useState<Msg>(null);

  const [genLength, setGenLength] = useState(16);
  const [genUppercase, setGenUppercase] = useState(true);
  const [genLowercase, setGenLowercase] = useState(true);
  const [genNumbers, setGenNumbers] = useState(true);
  const [genSymbols, setGenSymbols] = useState(true);
  const [genLoading, setGenLoading] = useState(false);
  const [genMsg, setGenMsg] = useState<Msg>(null);

  const [mfaSetupVisible, setMfaSetupVisible] = useState(false);
  const [mfaQrCode, setMfaQrCode] = useState("");
  const [mfaSecretText, setMfaSecretText] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaMsg, setMfaMsg] = useState<Msg>(null);
  const [mfaDisableVisible, setMfaDisableVisible] = useState(false);
  const [mfaDisablePwd, setMfaDisablePwd] = useState("");
  const [mfaDisableLoading, setMfaDisableLoading] = useState(false);

  const [aesKey, setAesKey] = useState("");
  const [aesLoading, setAesLoading] = useState(false);
  const [aesMsg, setAesMsg] = useState<Msg>(null);
  const [aesConfirmOpen, setAesConfirmOpen] = useState(false);
  const [aesProgress, setAesProgress] = useState<{ done: number; total: number; log: string[] } | null>(null);

  const [jwtSecret, setJwtSecret] = useState("");
  const [jwtLoading, setJwtLoading] = useState(false);
  const [jwtMsg, setJwtMsg] = useState<Msg>(null);
  const [jwtConfirmOpen, setJwtConfirmOpen] = useState(false);

  const [dbTesting, setDbTesting] = useState(false);
  const [dbResult, setDbResult] = useState<{ status: string; latencyMs?: number; error?: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND}/api/settings`, { credentials: "include" });
      if (res.status === 401) { router.push("/login"); return; }
      setSettings(await res.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (settings?.policy) setRotationDays(settings.policy.passwordRotationDays);
    if (settings?.generator) {
      setGenLength(settings.generator.length);
      setGenUppercase(settings.generator.uppercase);
      setGenLowercase(settings.generator.lowercase);
      setGenNumbers(settings.generator.numbers);
      setGenSymbols(settings.generator.symbols);
    }
  }, [settings]);

  function generateHex(bytes: number) {
    const arr = new Uint8Array(bytes);
    window.crypto.getRandomValues(arr);
    return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function callSettings(body: object): Promise<{ ok: boolean; data: { message?: string; error?: string } }> {
    const res = await fetch(`${BACKEND}/api/settings`, {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { ok: res.ok, data: await res.json() };
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwLoading(true); setPwMsg(null);
    try {
      const { ok, data } = await callSettings({ action: "changePassword", currentPassword: pwForm.current, newPassword: pwForm.newPwd, confirmPassword: pwForm.confirm });
      setPwMsg({ type: ok ? "success" : "error", text: (ok ? data.message : data.error) ?? "Error" });
      if (ok) setPwForm({ current: "", newPwd: "", confirm: "" });
    } catch { setPwMsg({ type: "error", text: "Network error" }); }
    finally { setPwLoading(false); }
  }

  async function handleUpdateRotationPolicy(e: React.FormEvent) {
    e.preventDefault();
    setRotationLoading(true); setRotationMsg(null);
    try {
      const { ok, data } = await callSettings({ action: "updatePasswordPolicy", passwordRotationDays: rotationDays });
      setRotationMsg({ type: ok ? "success" : "error", text: (ok ? data.message : data.error) ?? "Error" });
      if (ok) load();
    } catch { setRotationMsg({ type: "error", text: "Network error" }); }
    finally { setRotationLoading(false); }
  }

  async function handleUpdateGeneratorSettings(e: React.FormEvent) {
    e.preventDefault();
    setGenLoading(true); setGenMsg(null);
    try {
      const { ok, data } = await callSettings({ action: "updateGeneratorSettings", length: genLength, uppercase: genUppercase, lowercase: genLowercase, numbers: genNumbers, symbols: genSymbols });
      setGenMsg({ type: ok ? "success" : "error", text: (ok ? data.message : data.error) ?? "Error" });
      if (ok) load();
    } catch { setGenMsg({ type: "error", text: "Network error" }); }
    finally { setGenLoading(false); }
  }

  async function handleGenerateMfa() {
    setMfaLoading(true); setMfaMsg(null);
    try {
      const res = await settingsApi.generateMfa();
      setMfaQrCode(res.qrCode);
      setMfaSecretText(res.secret);
      setMfaSetupVisible(true);
    } catch (err: any) {
      setMfaMsg({ type: "error", text: err.message || "Failed to generate MFA" });
    } finally { setMfaLoading(false); }
  }

  async function handleEnableMfa(e: React.FormEvent) {
    e.preventDefault();
    setMfaLoading(true); setMfaMsg(null);
    try {
      await settingsApi.enableMfa(mfaCode);
      setMfaMsg({ type: "success", text: "MFA enabled successfully!" });
      setMfaSetupVisible(false); setMfaCode(""); load();
    } catch (err: any) {
      setMfaMsg({ type: "error", text: err.message || "Invalid code" });
    } finally { setMfaLoading(false); }
  }

  async function handleDisableMfa(e: React.FormEvent) {
    e.preventDefault();
    setMfaDisableLoading(true); setMfaMsg(null);
    try {
      await settingsApi.disableMfa(mfaDisablePwd);
      setMfaMsg({ type: "success", text: "MFA disabled successfully." });
      setMfaDisableVisible(false); setMfaDisablePwd(""); load();
    } catch (err: any) {
      setMfaMsg({ type: "error", text: err.message || "Failed to disable MFA" });
    } finally { setMfaDisableLoading(false); }
  }

  async function handleUpdateAesKey() {
    setAesConfirmOpen(false); setAesLoading(true); setAesMsg(null);
    setAesProgress({ done: 0, total: 0, log: [] });
    try {
      const res = await fetch(`${BACKEND}/api/settings/rotate-key`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newKey: aesKey }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        setAesMsg({ type: "error", text: err.error ?? "Failed to rotate key" }); return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const event of events) {
          const line = event.replace(/^data:\s*/, "");
          if (!line) continue;
          try {
            const msg = JSON.parse(line) as { type: string; total?: number; done?: number; reEncrypted?: number; message?: string };
            if (msg.type === "start") setAesProgress({ done: 0, total: msg.total ?? 0, log: [] });
            else if (msg.type === "progress") setAesProgress((prev) => ({ done: msg.done ?? 0, total: msg.total ?? prev?.total ?? 0, log: prev?.log ?? [] }));
            else if (msg.type === "done") {
              setAesProgress((prev) => ({ done: msg.reEncrypted ?? prev?.total ?? 0, total: prev?.total ?? 0, log: [] }));
              setAesMsg({ type: "success", text: `Key rotated. ${msg.reEncrypted} accounts re-encrypted.` });
              setAesKey(""); load();
            } else if (msg.type === "error") setAesMsg({ type: "error", text: msg.message ?? "Unknown error" });
          } catch { /* malformed */ }
        }
      }
    } catch { setAesMsg({ type: "error", text: "Network error during key rotation" }); }
    finally { setAesLoading(false); }
  }

  async function handleUpdateJwtSecret() {
    setJwtConfirmOpen(false); setJwtLoading(true); setJwtMsg(null);
    try {
      const { ok, data } = await callSettings({ action: "updateJwtSecret", newSecret: jwtSecret });
      setJwtMsg({ type: ok ? "success" : "error", text: (ok ? data.message : data.error) ?? "Error" });
      if (ok) { setJwtSecret(""); load(); setTimeout(() => router.push("/login"), 2000); }
    } catch { setJwtMsg({ type: "error", text: "Network error" }); }
    finally { setJwtLoading(false); }
  }

  async function handleTestDb() {
    setDbTesting(true); setDbResult(null);
    try {
      const { data } = await callSettings({ action: "testDb" });
      setDbResult(data as { status: string; latencyMs?: number; error?: string });
    } catch { setDbResult({ status: "error", error: "Network error" }); }
    finally { setDbTesting(false); }
  }

  const navItems: { key: SectionKey; label: string; icon: React.ReactNode }[] = [
    { key: "security", label: "Security", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg> },
    { key: "encryption", label: "Encryption", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg> },
    { key: "jwt", label: "JWT", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" /></svg> },
    { key: "database", label: "Database", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></svg> },
    { key: "appearance", label: "Appearance", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg> },
    { key: "data", label: "Data", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" /></svg> },
  ];

  const StatusBadge = ({ active }: { active: boolean }) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", padding: "0.25rem 0.75rem", borderRadius: "999px", fontSize: "0.75rem", fontWeight: 600, color: active ? "#4ade80" : "#f43f5e", background: active ? "rgba(74,222,128,0.12)" : "rgba(244,63,94,0.12)", border: `1px solid ${active ? "rgba(74,222,128,0.3)" : "rgba(244,63,94,0.3)"}` }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: active ? "#4ade80" : "#f43f5e", animation: "status-pulse 2s infinite" }} />
      {active ? "Active" : "Disabled"}
    </span>
  );

  const SectionTitle = ({ icon, children, desc }: { icon: React.ReactNode; children: React.ReactNode; desc?: string }) => (
    <div style={{ marginBottom: "1.5rem" }}>
      <div className="settings-section-title">{icon} {children}</div>
      {desc && <p style={{ fontSize: "0.825rem", color: "var(--text-muted)", marginTop: "0.375rem", lineHeight: 1.5 }}>{desc}</p>}
    </div>
  );

  const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1.5rem", padding: "0.875rem 0", borderBottom: "1px solid var(--border-subtle)" }}>
      <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)", fontWeight: 500 }}>{label}</span>
      <span>{value}</span>
    </div>
  );

  return (
    <AppShell>
      <div className="settings-page animate-fade-in">
        <div className="settings-header">
          <div>
            <h1 className="dashboard-title">Settings</h1>
            <p className="dashboard-subtitle">Manage your Veshtit configuration &amp; security preferences</p>
          </div>
        </div>

        <div className="settings-layout">
          {/* ── Side Nav ── */}
          <nav className="settings-nav">
            {navItems.map((item) => (
              <button
                key={item.key}
                className={`settings-nav-item${activeSection === item.key ? " active" : ""}`}
                onClick={() => setActiveSection(item.key)}
              >
                <span className="settings-nav-icon">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>

          {/* ── Main Content ── */}
          <div className="settings-content">
            {loading ? (
              <div className="empty-state"><Spinner /></div>
            ) : (
              <>
                {/* ══════════════════ SECURITY ══════════════════ */}
                {activeSection === "security" && (
                  <div className="settings-section settings-section-animate">
                    <SectionTitle icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>} desc="Manage authentication, 2FA, and password policies for your admin account">
                      Security Settings
                    </SectionTitle>

                    {/* 2-column grid */}
                    <div className="settings-panel-card">
                      {/* Admin Account */}
                      <Card>
                        <CardHeader icon="👤" title="Admin Account" subtitle="Basic profile credentials" />
                        <InfoRow label="Username" value={<code style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", background: "var(--bg-hover)", padding: "0.2rem 0.6rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>{settings?.security.username}</code>} />
                      </Card>

                      {/* Two-Factor Authentication */}
                      <Card>
                        <CardHeader icon="🛡️" title="Two-Factor Auth (2FA)" subtitle="TOTP barrier for your admin session" badge={<StatusBadge active={!!settings?.security.mfaEnabled} />} />
                        <Alert msg={mfaMsg} />
                        {settings?.security.mfaEnabled ? (
                          !mfaDisableVisible ? (
                            <div>
                              <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>✓ Authenticator app 2FA is active and protecting your archive.</p>
                              <button className="btn btn-secondary" style={{ color: "#f43f5e", borderColor: "rgba(244,63,94,0.3)" }} onClick={() => setMfaDisableVisible(true)}>
                                Disable 2FA
                              </button>
                            </div>
                          ) : (
                            <form className="settings-form" onSubmit={handleDisableMfa}>
                              <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>Enter your admin password to confirm disabling 2FA.</p>
                              <div className="form-group">
                                <label className="form-label" htmlFor="mfa-disable-pwd">Password</label>
                                <input id="mfa-disable-pwd" type="password" className="form-input" value={mfaDisablePwd} onChange={(e) => setMfaDisablePwd(e.target.value)} required />
                              </div>
                              <div style={{ display: "flex", gap: "0.5rem" }}>
                                <button type="button" className="btn btn-ghost" onClick={() => { setMfaDisableVisible(false); setMfaDisablePwd(""); }}>Cancel</button>
                                <button type="submit" className="btn btn-danger" disabled={mfaDisableLoading}>
                                  {mfaDisableLoading ? <Spinner /> : "Confirm & Disable"}
                                </button>
                              </div>
                            </form>
                          )
                        ) : (
                          !mfaSetupVisible ? (
                            <div>
                              <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>2FA is disabled. Add an extra layer of protection to your account.</p>
                              <button className="btn btn-primary" onClick={handleGenerateMfa} disabled={mfaLoading}>
                                {mfaLoading ? <Spinner /> : "Configure 2FA App"}
                              </button>
                            </div>
                          ) : (
                            <div>
                              {/* Step 1 */}
                              <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", alignItems: "flex-start" }}>
                                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--gradient-brand)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.875rem", flexShrink: 0 }}>1</div>
                                <div>
                                  <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "0.75rem" }}>Scan with Google Authenticator, Authy, or any TOTP app.</p>
                                  <div style={{ background: "white", padding: "0.875rem", display: "inline-block", borderRadius: "var(--radius-lg)", marginBottom: "0.75rem" }}>
                                    {mfaQrCode && <img src={mfaQrCode} alt="MFA QR Code" width="150" height="150" />}
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "var(--bg-hover)", borderRadius: "var(--radius-md)", padding: "0.5rem 0.75rem", border: "1px solid var(--border-subtle)" }}>
                                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Secret:</span>
                                    <code style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "var(--text-primary)", flex: 1 }}>{mfaSecretText}</code>
                                    <button type="button" className="btn btn-ghost" style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }} onClick={() => navigator.clipboard.writeText(mfaSecretText)}>Copy</button>
                                  </div>
                                </div>
                              </div>
                              {/* Step 2 */}
                              <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--gradient-brand)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.875rem", flexShrink: 0 }}>2</div>
                                <form className="settings-form" style={{ flex: 1 }} onSubmit={handleEnableMfa}>
                                  <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "0.75rem" }}>Enter the 6-digit code from your authenticator app.</p>
                                  <div className="form-group" style={{ maxWidth: "200px" }}>
                                    <input id="mfa-code" type="text" className="form-input" style={{ textAlign: "center", letterSpacing: "0.25em", fontFamily: "var(--font-mono)", fontSize: "1.1rem" }} value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} placeholder="000000" maxLength={6} required />
                                  </div>
                                  <div style={{ display: "flex", gap: "0.5rem" }}>
                                    <button type="button" className="btn btn-ghost" onClick={() => { setMfaSetupVisible(false); setMfaCode(""); }}>Cancel</button>
                                    <button type="submit" className="btn btn-primary" disabled={mfaLoading}>
                                      {mfaLoading ? <Spinner /> : "Verify & Enable 2FA"}
                                    </button>
                                  </div>
                                </form>
                              </div>
                            </div>
                          )
                        )}
                      </Card>

                      {/* Change Password */}
                      <Card>
                        <CardHeader icon="🔑" title="Change Password" subtitle="Update your admin login password" />
                        <Alert msg={pwMsg} />
                        <form className="settings-form" onSubmit={handleChangePassword}>
                          <div className="form-group">
                            <label className="form-label" htmlFor="current-pwd">Current Password</label>
                            <input id="current-pwd" type="password" className="form-input" value={pwForm.current} onChange={(e) => setPwForm((f) => ({ ...f, current: e.target.value }))} placeholder="Enter current password" required />
                          </div>
                          <div className="form-group">
                            <label className="form-label" htmlFor="new-pwd">New Password</label>
                            <input id="new-pwd" type="password" className="form-input" value={pwForm.newPwd} onChange={(e) => setPwForm((f) => ({ ...f, newPwd: e.target.value }))} placeholder="At least 8 characters" required minLength={8} />
                          </div>
                          <div className="form-group">
                            <label className="form-label" htmlFor="confirm-pwd">Confirm Password</label>
                            <input id="confirm-pwd" type="password" className="form-input" value={pwForm.confirm} onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))} placeholder="Repeat new password" required />
                          </div>
                          <button type="submit" className="btn btn-primary" disabled={pwLoading} id="save-password-btn">
                            {pwLoading ? <Spinner /> : <>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v14a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
                              Save Password
                            </>}
                          </button>
                        </form>
                      </Card>

                      {/* Security Policy */}
                      <Card>
                        <CardHeader icon="🕐" title="Security Policy" subtitle="Configure password rotation reminders" />
                        <Alert msg={rotationMsg} />
                        <form className="settings-form" onSubmit={handleUpdateRotationPolicy}>
                          <div className="form-group">
                            <label className="form-label" htmlFor="rotation-days">
                              Rotation Period: <span style={{ color: "var(--accent-primary)", fontWeight: 600 }}>{rotationDays} days</span>
                            </label>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                              <input id="rotation-days" type="number" min="1" className="form-input" style={{ width: "120px" }} value={rotationDays} onChange={(e) => setRotationDays(parseInt(e.target.value) || 90)} required />
                              <button type="submit" className="btn btn-secondary" disabled={rotationLoading}>
                                {rotationLoading ? <Spinner /> : "Save"}
                              </button>
                            </div>
                            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
                              {[30, 90, 180, 365].map((d) => (
                                <button key={d} type="button" className={`policy-chip-btn${rotationDays === d ? " active" : ""}`} onClick={() => setRotationDays(d)}>
                                  {d}d {d === 90 ? "✓" : ""}
                                </button>
                              ))}
                            </div>
                          </div>
                        </form>
                      </Card>

                      {/* Password Generator — full-width */}
                      <Card style={{ gridColumn: "1 / -1" }}>
                        <CardHeader icon="⚙️" title="Password Generator Rules" subtitle="Configure defaults for automatic password generation" />
                        <Alert msg={genMsg} />
                        <form className="settings-form" onSubmit={handleUpdateGeneratorSettings}>
                          <div className="form-group">
                            <label className="form-label" htmlFor="gen-length">
                              Password Length: <span style={{ color: "var(--accent-primary)", fontWeight: 600, fontFamily: "var(--font-mono)" }}>{genLength} chars</span>
                            </label>
                            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                              <input id="gen-length-slider" type="range" min="6" max="64" className="form-range" value={genLength} style={{ flex: 1 }} onChange={(e) => setGenLength(parseInt(e.target.value))} />
                              <input id="gen-length" type="number" min="4" max="128" className="form-input" value={genLength} style={{ width: "80px", textAlign: "center" }} onChange={(e) => setGenLength(parseInt(e.target.value) || 16)} required />
                            </div>
                          </div>
                          <div className="generator-checkbox-grid">
                            {[
                              { id: "gen-upper", checked: genUppercase, setter: setGenUppercase, title: "Uppercase (A-Z)", desc: "ABCDEFGHIJKLMNOPQRSTUVWXYZ" },
                              { id: "gen-lower", checked: genLowercase, setter: setGenLowercase, title: "Lowercase (a-z)", desc: "abcdefghijklmnopqrstuvwxyz" },
                              { id: "gen-num", checked: genNumbers, setter: setGenNumbers, title: "Numbers (0-9)", desc: "0123456789" },
                              { id: "gen-sym", checked: genSymbols, setter: setGenSymbols, title: "Symbols (!@#...)", desc: "!@#$%^&*()_+-=" },
                            ].map((item) => (
                              <label key={item.id} className={`generator-checkbox-card${item.checked ? " active" : ""}`}>
                                <input type="checkbox" checked={item.checked} onChange={(e) => item.setter(e.target.checked)} />
                                <div className="checkbox-card-content">
                                  <span className="checkbox-card-title">{item.title}</span>
                                  <span className="checkbox-card-desc">{item.desc}</span>
                                </div>
                              </label>
                            ))}
                          </div>
                          <button type="submit" className="btn btn-primary" disabled={genLoading} id="save-generator-btn">
                            {genLoading ? <Spinner /> : "Save Generator Settings"}
                          </button>
                        </form>
                      </Card>
                    </div>
                  </div>
                )}

                {/* ══════════════════ ENCRYPTION ══════════════════ */}
                {activeSection === "encryption" && (
                  <div className="settings-section settings-section-animate">
                    <SectionTitle icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>} desc="Configure the AES-256-GCM master key used to encrypt all stored credentials">
                      Encryption Settings
                    </SectionTitle>
                    <div className="settings-cards-grid">
                      {/* AES Status */}
                      <Card>
                        <div style={{ display: "flex", alignItems: "center", gap: "1rem", background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: "var(--radius-xl)", padding: "1.25rem", marginBottom: "1.5rem" }}>
                          <div style={{ fontSize: "2rem" }}>🛡️</div>
                          <div style={{ flex: 1 }}>
                            <p style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-primary)", margin: 0 }}>AES-256-GCM Active</p>
                            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.125rem", margin: 0 }}>Military-grade authenticated encryption</p>
                          </div>
                          <StatusBadge active={true} />
                        </div>
                        <InfoRow label="Algorithm" value={<code style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", background: "var(--bg-hover)", padding: "0.2rem 0.6rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>AES-256-GCM</code>} />
                        <InfoRow label="Key Fingerprint" value={<code style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", background: "var(--bg-hover)", padding: "0.2rem 0.6rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>{settings?.encryption.keyMasked}</code>} />
                      </Card>

                      {/* Rotate Key */}
                      <Card>
                        <CardHeader icon="🔄" title="Rotate Encryption Key" subtitle="Update the symmetric master key for credential encryption" />
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", padding: "1rem", borderRadius: "var(--radius-lg)", background: "rgba(251,191,36,0.08)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.25)", marginBottom: "1.25rem", fontSize: "0.85rem", lineHeight: 1.6 }}>
                          <svg style={{ flexShrink: 0, marginTop: "2px" }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                          <span><strong>Key Rotation Hazard:</strong> All accounts will be decrypted and re-encrypted under the new key. Ensure you have a data backup.</span>
                        </div>
                        <Alert msg={aesMsg} />
                        <div className="key-input-row">
                          <div className="form-group" style={{ flex: 1 }}>
                            <label className="form-label" htmlFor="aes-key-input">New AES Key <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(64 hex · 32 bytes)</span></label>
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                              <input id="aes-key-input" className="form-input mono" value={aesKey} onChange={(e) => setAesKey(e.target.value.toLowerCase())} placeholder="Enter or generate a 64-character hex key" maxLength={64} spellCheck={false} />
                              <button type="button" className="btn btn-secondary" onClick={() => setAesKey(generateHex(32))} style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
                                🔄 Generate
                              </button>
                            </div>
                            <div style={{ fontSize: "0.72rem", marginTop: "0.3rem", color: aesKey.length === 64 ? "#4ade80" : "var(--text-muted)" }}>
                              {aesKey.length}/64 characters {aesKey.length === 64 ? "✓" : ""}
                            </div>
                          </div>
                        </div>
                        {aesLoading && aesProgress ? (
                          <div className="rotation-progress-box">
                            <div className="rotation-progress-header"><Spinner /><span>Re-encrypting… {aesProgress.done}/{aesProgress.total}</span></div>
                            <div className="rotation-progress-track">
                              <div className="rotation-progress-fill" style={{ width: aesProgress.total > 0 ? `${Math.round((aesProgress.done / aesProgress.total) * 100)}%` : "0%" }} />
                            </div>
                            <div className="rotation-progress-pct">{aesProgress.total > 0 ? `${Math.round((aesProgress.done / aesProgress.total) * 100)}%` : "Starting…"}</div>
                          </div>
                        ) : aesConfirmOpen ? (
                          <div className="confirm-box confirm-box-danger">
                            <p className="confirm-box-title">
                              <svg style={{ flexShrink: 0 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                              <span>All accounts will be re-encrypted. This cannot be undone.</span>
                            </p>
                            <div className="confirm-box-actions">
                              <button className="btn btn-ghost btn-sm" onClick={() => setAesConfirmOpen(false)}>Cancel</button>
                              <button className="btn btn-danger btn-sm" onClick={handleUpdateAesKey} disabled={aesLoading}>Yes, Rotate Key</button>
                            </div>
                          </div>
                        ) : (
                          <button id="update-aes-btn" className="btn btn-primary" disabled={aesKey.length !== 64 || !/^[0-9a-f]+$/i.test(aesKey) || aesLoading} onClick={() => setAesConfirmOpen(true)} style={{ marginTop: "0.5rem" }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                            Update Encryption Key
                          </button>
                        )}
                      </Card>
                    </div>
                  </div>
                )}

                {/* ══════════════════ JWT ══════════════════ */}
                {activeSection === "jwt" && (
                  <div className="settings-section settings-section-animate">
                    <SectionTitle icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" /></svg>} desc="Manage the signing secret for admin session tokens — rotating it invalidates all active sessions">
                      JWT Session Secret
                    </SectionTitle>
                    <div className="settings-cards-grid">
                      {/* JWT Info */}
                      <Card>
                        <CardHeader icon="🔐" title="JWT Signature Config" subtitle="Cryptographic key used to verify user sessions" />
                        <InfoRow label="Active Secret" value={<code style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", background: "var(--bg-hover)", padding: "0.2rem 0.6rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>{settings?.jwt?.secretMasked ?? "••••••••"}</code>} />
                        <InfoRow label="Storage" value={<code style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", background: "var(--bg-hover)", padding: "0.2rem 0.6rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>MongoDB settings</code>} />
                      </Card>

                      {/* Rotate JWT */}
                      <Card>
                        <CardHeader icon="⚡" title="Rotate JWT Secret" subtitle="Force all users to re-authenticate" />
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", padding: "1rem", borderRadius: "var(--radius-lg)", background: "rgba(244,63,94,0.08)", color: "#f43f5e", border: "1px solid rgba(244,63,94,0.25)", marginBottom: "1.25rem", fontSize: "0.85rem", lineHeight: 1.6 }}>
                          <svg style={{ flexShrink: 0, marginTop: "2px" }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                          <span><strong>Session Disruption:</strong> Updating this secret immediately invalidates all active JWT tokens. Every user will be logged out.</span>
                        </div>
                        <Alert msg={jwtMsg} />
                        <div className="key-input-row">
                          <div className="form-group" style={{ flex: 1 }}>
                            <label className="form-label" htmlFor="jwt-secret-input">New JWT Secret <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(min. 32 chars)</span></label>
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                              <input id="jwt-secret-input" className="form-input mono" value={jwtSecret} onChange={(e) => setJwtSecret(e.target.value)} placeholder="Enter or generate a random secret" spellCheck={false} />
                              <button type="button" className="btn btn-secondary" onClick={() => setJwtSecret(generateHex(32))} style={{ flexShrink: 0, whiteSpace: "nowrap" }}>⚡ Generate</button>
                            </div>
                            <div style={{ fontSize: "0.72rem", marginTop: "0.3rem", color: jwtSecret.length >= 32 ? "#4ade80" : "var(--text-muted)" }}>
                              {jwtSecret.length} chars {jwtSecret.length >= 32 ? "✓" : `(need ${32 - jwtSecret.length} more)`}
                            </div>
                          </div>
                        </div>
                        {jwtConfirmOpen ? (
                          <div className="confirm-box confirm-box-danger">
                            <p className="confirm-box-title">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                              <span>This will log out all active sessions. Continue?</span>
                            </p>
                            <div className="confirm-box-actions">
                              <button className="btn btn-ghost btn-sm" onClick={() => setJwtConfirmOpen(false)}>Cancel</button>
                              <button className="btn btn-danger btn-sm" onClick={handleUpdateJwtSecret} disabled={jwtLoading}>
                                {jwtLoading ? <Spinner /> : null} Yes, Rotate JWT
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button id="update-jwt-btn" className="btn btn-primary" disabled={jwtSecret.length < 32 || jwtLoading} onClick={() => setJwtConfirmOpen(true)} style={{ marginTop: "0.5rem" }}>
                            {jwtLoading ? <Spinner /> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-4.93" /></svg>}
                            Rotate JWT Secret
                          </button>
                        )}
                      </Card>
                    </div>
                  </div>
                )}

                {/* ══════════════════ DATABASE ══════════════════ */}
                {activeSection === "database" && (
                  <div className="settings-section settings-section-animate">
                    <SectionTitle icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></svg>} desc="View your MongoDB connection details and run a live latency test">
                      Database Settings
                    </SectionTitle>
                    <div className="settings-cards-grid">
                      {/* MongoDB Config */}
                      <Card>
                        <CardHeader icon="📂" title="MongoDB Configuration" subtitle="Active connection config for data persistence" />
                        <InfoRow label="Connection URI" value={<code style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", background: "var(--bg-hover)", padding: "0.2rem 0.6rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)", wordBreak: "break-all" }}>{settings?.database.uriMasked}</code>} />
                        <InfoRow label="Live Status" value={
                          settings?.database.status === "connected" ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", padding: "0.25rem 0.75rem", borderRadius: "999px", fontSize: "0.75rem", fontWeight: 600, color: "#4ade80", background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.3)" }}>
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", animation: "status-pulse 2s infinite" }} />
                              Connected {settings.database.latencyMs != null ? `(${settings.database.latencyMs}ms)` : ""}
                            </span>
                          ) : (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", padding: "0.25rem 0.75rem", borderRadius: "999px", fontSize: "0.75rem", fontWeight: 600, color: "#f43f5e", background: "rgba(244,63,94,0.12)", border: "1px solid rgba(244,63,94,0.3)" }}>
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f43f5e" }} /> Disconnected
                            </span>
                          )
                        } />
                      </Card>

                      {/* Diagnostics */}
                      <Card>
                        <CardHeader icon="⚡" title="Database Diagnostics" subtitle="Verify response latency and connection endpoints" />
                        {dbResult && (
                          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", padding: "0.875rem 1rem", borderRadius: "var(--radius-lg)", marginBottom: "1.25rem", fontSize: "0.875rem", ...(dbResult.status === "connected" ? { background: "rgba(74,222,128,0.08)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.25)" } : { background: "rgba(244,63,94,0.08)", color: "#f43f5e", border: "1px solid rgba(244,63,94,0.25)" }) }}>
                            {dbResult.status === "connected" ? (
                              <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg><span>Success! Latency: <strong>{dbResult.latencyMs}ms</strong> — Connection is stable.</span></>
                            ) : (
                              <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg><span>Error: <code>{dbResult.error}</code></span></>
                            )}
                          </div>
                        )}
                        <button id="test-db-btn" className="btn btn-secondary" onClick={handleTestDb} disabled={dbTesting}>
                          {dbTesting ? <Spinner /> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>}
                          Test Latency &amp; Connection
                        </button>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.625rem", padding: "0.875rem 1rem", borderRadius: "var(--radius-lg)", marginTop: "1.25rem", background: "var(--accent-primary-dim)", border: "1px solid var(--border-subtle)", fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                          <svg width="14" height="14" style={{ marginTop: "2px", flexShrink: 0 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                          <span>To update connection credentials, change <code>MONGODB_URI</code> in the backend <code>.env</code> file and restart.</span>
                        </div>
                      </Card>
                    </div>
                  </div>
                )}

                {/* ══════════════════ APPEARANCE ══════════════════ */}
                {activeSection === "appearance" && (
                  <div className="settings-section settings-section-animate">
                    <SectionTitle icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>} desc="Choose between dark and light mode — preference is saved in browser storage">
                      Appearance &amp; Theme
                    </SectionTitle>
                    <Card>
                      <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: "1.5rem", lineHeight: 1.6 }}>
                        Choose a theme that matches your preference. Your selection is saved locally in browser storage.
                      </p>
                      <div className="theme-picker-grid">
                        {[
                          { id: "dark", name: "Dark Mode", icon: "🌙", desc: "Sleek dark layout with glassmorphism glow" },
                          { id: "light", name: "Light Mode", icon: "☀️", desc: "Clean light layout with soft frosted details" },
                        ].map((t) => {
                          const isActive = theme === t.id;
                          return (
                            <button
                              key={t.id}
                              type="button"
                              className={`theme-picker-btn${isActive ? " active" : ""}`}
                              onClick={() => { if (theme !== t.id) toggleTheme(); }}
                            >
                              <div className={`theme-preview-mock theme-preview-${t.id}`}>
                                <div className="mock-titlebar">
                                  <span className="dot dot-r" /><span className="dot dot-y" /><span className="dot dot-g" />
                                </div>
                                <div className="mock-body">
                                  <div className="mock-line-title" />
                                  <div className="mock-card">
                                    <div className="mock-card-icon" />
                                    <div className="mock-card-lines">
                                      <div className="mock-line-sm" /><div className="mock-line-xs" />
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="theme-picker-card-info">
                                <span className="theme-picker-label-name">{isActive ? "✨ " : ""}{t.icon} {t.name}</span>
                                <span className="theme-picker-label-desc">{t.desc}</span>
                              </div>
                              {isActive && (
                                <div className="theme-active-tag">
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><polyline points="20 6 9 17 4 12" /></svg>
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </Card>
                  </div>
                )}

                {/* ══════════════════ DATA ══════════════════ */}
                {activeSection === "data" && (
                  <div className="settings-section settings-section-animate">
                    <SectionTitle icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" /></svg>} desc="Export all credentials as a decrypted JSON backup or import a previously saved archive">
                      Data Management
                    </SectionTitle>
                    <Card>
                      <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: "1.5rem", lineHeight: 1.6 }}>
                        Backup or restore all credential accounts. Export JSON files for local portability and offline recovery.
                      </p>
                      <div className="settings-data-grid">
                        <div className="settings-data-action-card">
                          <div className="settings-data-card-icon" style={{ color: "var(--accent-primary)", background: "var(--accent-primary-dim)" }}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                          </div>
                          <div className="settings-data-card-body">
                            <h4>Export Accounts Archive</h4>
                            <p>Download all service provider credentials as a decrypted JSON archive.</p>
                          </div>
                          <button id="export-data-btn" className="btn btn-secondary btn-full" onClick={async () => {
                            const res = await fetch(`${BACKEND}/api/export`, { credentials: "include" });
                            const blob = await res.blob();
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url; a.download = "veshtit-export.json"; a.click();
                            URL.revokeObjectURL(url);
                          }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                            Export Backup
                          </button>
                        </div>
                        <div className="settings-data-action-card">
                          <div className="settings-data-card-icon" style={{ color: "var(--accent-secondary)", background: "var(--accent-secondary-dim)" }}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                          </div>
                          <div className="settings-data-card-body">
                            <h4>Import Accounts File</h4>
                            <p>Import provider collections directly from a saved JSON credentials file.</p>
                          </div>
                          <button id="import-data-btn" className="btn btn-secondary btn-full" onClick={() => router.push("/accounts")}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                            Go to Import
                          </button>
                        </div>
                      </div>
                    </Card>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
