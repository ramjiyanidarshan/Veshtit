"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { settingsApi, sessionsApi, Session } from "@/lib/api";
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

type SectionKey = "security" | "sessions" | "encryption" | "jwt" | "database" | "appearance" | "data";
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

function CardHeader({ icon, title, subtitle, badge }: { icon: React.ReactNode; title: string; subtitle: string; badge?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
      <div style={{ width: 40, height: 40, borderRadius: "var(--radius-md)", background: "var(--bg-hover)", border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", flexShrink: 0 }}>
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
  const [isCustomRotation, setIsCustomRotation] = useState(false);
  const [customDaysInput, setCustomDaysInput] = useState("90");
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

  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [terminatingId, setTerminatingId] = useState<string | null>(null);
  const [sessionsMsg, setSessionsMsg] = useState<Msg>(null);

  const [unameForm, setUnameForm] = useState({ newUsername: "" });
  const [unameLoading, setUnameLoading] = useState(false);
  const [unameMsg, setUnameMsg] = useState<Msg>(null);

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
    if (settings?.policy) {
      const days = settings.policy.passwordRotationDays;
      setRotationDays(days);
      const isPreset = [30, 90, 180, 365].includes(days);
      setIsCustomRotation(!isPreset);
      setCustomDaysInput(days.toString());
    }
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

  async function handleSaveRotationDays(days: number) {
    setRotationLoading(true); setRotationMsg(null);
    try {
      const { ok, data } = await callSettings({ action: "updatePasswordPolicy", passwordRotationDays: days });
      setRotationMsg({ type: ok ? "success" : "error", text: (ok ? data.message : data.error) ?? "Error" });
      if (ok) load();
    } catch { setRotationMsg({ type: "error", text: "Network error" }); }
    finally { setRotationLoading(false); }
  }

  async function handleUpdateRotationPolicy(e: React.FormEvent) {
    e.preventDefault();
    const days = parseInt(customDaysInput) || 90;
    handleSaveRotationDays(days);
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

  async function loadSessions() {
    setSessionsLoading(true); setSessionsMsg(null);
    try {
      const res = await sessionsApi.list();
      setSessions(res.sessions);
      setCurrentSessionId(res.currentSessionId);
    } catch {
      setSessionsMsg({ type: "error", text: "Failed to load sessions" });
    } finally {
      setSessionsLoading(false);
    }
  }

  async function handleTerminate(sessionId: string) {
    setTerminatingId(sessionId); setSessionsMsg(null);
    try {
      await sessionsApi.terminate(sessionId);
      setSessions((prev) => prev.map((s) => s.sessionId === sessionId ? { ...s, status: "terminated" as const } : s));
      setSessionsMsg({ type: "success", text: "Session terminated successfully." });
    } catch (err: any) {
      setSessionsMsg({ type: "error", text: err.message || "Failed to terminate session" });
    } finally {
      setTerminatingId(null);
    }
  }

  async function handleChangeUsername(e: React.FormEvent) {
    e.preventDefault();
    setUnameLoading(true); setUnameMsg(null);
    try {
      const res = await settingsApi.changeUsername(unameForm.newUsername);
      setUnameMsg({ type: "success", text: res.message });
      setUnameForm({ newUsername: "" });
      load();
    } catch (err: any) {
      setUnameMsg({ type: "error", text: err.message || "Failed to change username" });
    } finally {
      setUnameLoading(false);
    }
  }

  useEffect(() => {
    if (activeSection === "sessions") loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection]);

  function generateUsername() {
    const adjectives = ["swift", "bold", "calm", "dark", "epic", "fast", "gold", "iron", "jade", "keen", "lush", "mint", "nova", "pale", "rare", "sage", "tall", "vast", "warm", "zeal"];
    const nouns = ["wolf", "hawk", "bear", "lynx", "fox", "deer", "crow", "seal", "pike", "kite", "wren", "dove", "mole", "vole", "ibis", "crab", "tern", "newt", "toad", "wasp"];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(Math.random() * 900) + 100;
    setUnameForm({ newUsername: `${adj}_${noun}_${num}` });
  }

  const navItems: { key: SectionKey; label: string; icon: React.ReactNode }[] = [
    { key: "security", label: "Security", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg> },
    { key: "sessions", label: "Sessions", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></svg> },
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
                        <CardHeader icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>} title="Admin Account" subtitle="Basic profile credentials" />
                        <InfoRow label="Current Username" value={<code style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", background: "var(--bg-hover)", padding: "0.2rem 0.6rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>{settings?.security.username}</code>} />
                        <div style={{ marginTop: "1.25rem", paddingTop: "1.25rem", borderTop: "1px solid var(--border-subtle)" }}>
                          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "1rem", lineHeight: 1.5 }}>
                            Change your login username for double security — you must remember both your username and password.
                          </p>
                          <Alert msg={unameMsg} />
                          <form className="settings-form" onSubmit={handleChangeUsername}>
                            <div className="form-group">
                              <label className="form-label" htmlFor="new-username">New Username</label>
                              <div style={{ display: "flex", gap: "0.5rem" }}>
                                <input
                                  id="new-username"
                                  type="text"
                                  className="form-input"
                                  style={{ fontFamily: "var(--font-mono)" }}
                                  value={unameForm.newUsername}
                                  onChange={(e) => setUnameForm({ newUsername: e.target.value })}
                                  placeholder="Min 3 chars, letters / numbers / _.-"
                                  minLength={3}
                                  required
                                />
                                <button type="button" className="btn btn-secondary" style={{ flexShrink: 0, whiteSpace: "nowrap", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={generateUsername} title="Generate random username">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><circle cx="15.5" cy="15.5" r="1.5"/><circle cx="15.5" cy="8.5" r="1.5"/><circle cx="8.5" cy="15.5" r="1.5"/><circle cx="12" cy="12" r="1.5"/></svg>
                                </button>
                              </div>
                            </div>
                            <button type="submit" className="btn btn-primary" disabled={unameLoading}>
                              {unameLoading ? <Spinner /> : "Change Username"}
                            </button>
                          </form>
                        </div>
                      </Card>

                      {/* Two-Factor Authentication */}
                      <Card>
                        <CardHeader icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>} title="Two-Factor Auth (2FA)" subtitle="TOTP barrier for your admin session" badge={<StatusBadge active={!!settings?.security.mfaEnabled} />} />
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
                        <CardHeader icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5l-.5-.5"/></svg>} title="Change Password" subtitle="Update your admin login password" />
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

                      {/* Password Policies & Generator */}
                      <Card>
                        <CardHeader icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>} title="Policies & Generator" subtitle="Configure password rotation reminders and generation rules" />
                        
                        <div className="policies-generator-combined" style={{ display: "flex", flexDirection: "column", gap: "1.75rem", marginTop: "0.5rem" }}>
                          {/* Top Section: Security Policy (Rotation) */}
                          <div>
                            <h4 style={{ fontSize: "0.9rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "6px" }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                              Rotation Reminders
                            </h4>
                            <Alert msg={rotationMsg} />
                            
                            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                              <div>
                                <label className="form-label" style={{ marginBottom: "0.5rem" }}>
                                  Rotation Period
                                </label>
                                <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", background: "rgba(255,255,255,0.03)", padding: "3px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                                  {[30, 90, 180, 365].map((d) => {
                                    const isSelected = rotationDays === d && !isCustomRotation;
                                    return (
                                      <button
                                        key={d}
                                        type="button"
                                        className={`btn btn-sm ${isSelected ? "btn-primary" : "btn-ghost"}`}
                                        style={{
                                          flex: 1,
                                          minWidth: "60px",
                                          padding: "0.35rem 0.5rem",
                                          fontSize: "0.78rem",
                                          borderRadius: "var(--radius-sm)",
                                          height: "32px",
                                          border: isSelected ? undefined : "none",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          gap: "4px"
                                        }}
                                        onClick={() => {
                                          setIsCustomRotation(false);
                                          handleSaveRotationDays(d);
                                        }}
                                      >
                                        {isSelected && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                                        {d}d
                                      </button>
                                    );
                                  })}
                                  <button
                                    type="button"
                                    className={`btn btn-sm ${isCustomRotation ? "btn-primary" : "btn-ghost"}`}
                                    style={{
                                      flex: 1,
                                      minWidth: "60px",
                                      padding: "0.35rem 0.5rem",
                                      fontSize: "0.78rem",
                                      borderRadius: "var(--radius-sm)",
                                      height: "32px",
                                      border: isCustomRotation ? undefined : "none",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      gap: "4px"
                                    }}
                                    onClick={() => {
                                      setIsCustomRotation(true);
                                    }}
                                  >
                                    {isCustomRotation && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                                    Custom
                                  </button>
                                </div>
                              </div>

                              {isCustomRotation && (
                                <form className="settings-form" onSubmit={handleUpdateRotationPolicy} style={{ display: "flex", flexDirection: "column", gap: "0.75rem", padding: "1rem", borderRadius: "var(--radius-lg)", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-subtle)", marginTop: "0.25rem" }}>
                                  <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label" htmlFor="rotation-days" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
                                      Custom Duration (Days)
                                    </label>
                                    <div style={{ display: "flex", gap: "0.5rem" }}>
                                      <input
                                        id="rotation-days"
                                        type="number"
                                        min="1"
                                        className="form-input"
                                        style={{ flex: 1 }}
                                        value={customDaysInput}
                                        onChange={(e) => setCustomDaysInput(e.target.value)}
                                        placeholder="e.g. 45"
                                        required
                                      />
                                      <button type="submit" className="btn btn-primary" style={{ padding: "0 1rem", height: "42px", minHeight: "unset" }} disabled={rotationLoading}>
                                        {rotationLoading ? <Spinner /> : "Save"}
                                      </button>
                                    </div>
                                  </div>
                                </form>
                              )}
                            </div>
                          </div>

                          {/* Divider */}
                          <div style={{ borderTop: "1px solid var(--border-subtle)" }} />

                          {/* Bottom Section: Password Generator Rules */}
                          <div>
                            <h4 style={{ fontSize: "0.9rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "6px" }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                              Generator Defaults
                            </h4>
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
                          </div>
                        </div>
                      </Card>
                    </div>
                  </div>
                )}

                {/* ══════════════════ SESSIONS ══════════════════ */}
                {activeSection === "sessions" && (
                  <div className="settings-section settings-section-animate">
                    <SectionTitle
                      icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></svg>}
                      desc="All login sessions tied to your account — view device info, trace audit events, and terminate any active session remotely"
                    >
                      Active Sessions
                    </SectionTitle>

                    <Alert msg={sessionsMsg} />

                    {sessionsLoading ? (
                      <div className="empty-state"><Spinner /></div>
                    ) : sessions.length === 0 ? (
                      <Card>
                        <div className="empty-state" style={{ padding: "2rem 0" }}>
                          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></svg>
                          <p style={{ color: "var(--text-muted)", marginTop: "0.75rem" }}>No session records found.</p>
                        </div>
                      </Card>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                        {sessions.map((session) => {
                          const isCurrent = session.sessionId === currentSessionId;
                          const isExpanded = expandedSession === session.sessionId;
                          const statusColors: Record<string, { bg: string; color: string; border: string }> = {
                            active: { bg: "rgba(74,222,128,0.1)", color: "#4ade80", border: "rgba(74,222,128,0.3)" },
                            expired: { bg: "rgba(251,191,36,0.1)", color: "#fbbf24", border: "rgba(251,191,36,0.3)" },
                            logged_out: { bg: "rgba(148,163,184,0.1)", color: "#94a3b8", border: "rgba(148,163,184,0.3)" },
                            terminated: { bg: "rgba(244,63,94,0.1)", color: "#f43f5e", border: "rgba(244,63,94,0.3)" },
                          };
                          const sc = statusColors[session.status] ?? statusColors.expired;
                          const deviceIcon = session.deviceType === "mobile" || session.deviceType === "tablet" ? (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--text-secondary)" }}><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                          ) : session.deviceType === "desktop" ? (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--text-secondary)" }}><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                          ) : (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--text-secondary)" }}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                          );
                          const loginDate = new Date(session.loginAt).toLocaleString();
                          const lastActiveDate = new Date(session.lastActiveAt).toLocaleString();
                          const endDate = session.logoutAt ? new Date(session.logoutAt).toLocaleString()
                            : session.terminatedAt ? new Date(session.terminatedAt).toLocaleString()
                            : null;

                          return (
                            <div key={session.sessionId} style={{ background: "var(--bg-glass)", backdropFilter: "blur(20px)", border: `1px solid ${isCurrent ? "rgba(99,102,241,0.4)" : "var(--border-subtle)"}`, borderRadius: "var(--radius-xl)", overflow: "hidden", boxShadow: isCurrent ? "0 0 0 1px rgba(99,102,241,0.2)" : "none" }}>
                              {/* Session header */}
                              <div style={{ padding: "1.25rem 1.5rem", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{deviceIcon}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.25rem" }}>
                                    <span style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--text-primary)" }}>{session.os} · {session.browser}</span>
                                    {isCurrent && (
                                      <span style={{ fontSize: "0.7rem", fontWeight: 700, padding: "0.15rem 0.5rem", borderRadius: "999px", background: "rgba(99,102,241,0.15)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.35)" }}>
                                        Current
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                                    <span>IP: {session.ipAddress}</span>
                                    <span>Login: {loginDate}</span>
                                    <span>Active: {lastActiveDate}</span>
                                    {endDate && <span>{session.status === "logged_out" ? "Logout" : "Ended"}: {endDate}</span>}
                                  </div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
                                  <span style={{ fontSize: "0.75rem", fontWeight: 600, padding: "0.25rem 0.75rem", borderRadius: "999px", background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, textTransform: "capitalize" }}>
                                    {session.status.replace("_", " ")}
                                  </span>
                                  {session.status === "active" && !isCurrent && (
                                    <button
                                      className="btn btn-secondary"
                                      style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem", color: "#f43f5e", borderColor: "rgba(244,63,94,0.3)" }}
                                      disabled={terminatingId === session.sessionId}
                                      onClick={() => handleTerminate(session.sessionId)}
                                    >
                                      {terminatingId === session.sessionId ? <Spinner /> : "Terminate"}
                                    </button>
                                  )}
                                  <button
                                    className="btn btn-ghost"
                                    style={{ fontSize: "0.8rem", padding: "0.35rem 0.5rem" }}
                                    onClick={() => setExpandedSession(isExpanded ? null : session.sessionId)}
                                    title={isExpanded ? "Collapse audit log" : "Expand audit log"}
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                                      <polyline points="6 9 12 15 18 9" />
                                    </svg>
                                  </button>
                                </div>
                              </div>

                              {/* Audit log */}
                              {isExpanded && (
                                <div style={{ borderTop: "1px solid var(--border-subtle)", padding: "1rem 1.5rem", background: "var(--bg-secondary)" }}>
                                  <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                    Audit Trail
                                  </p>
                                  {session.auditLog && session.auditLog.length > 0 ? (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                      {session.auditLog.map((entry, i) => (
                                        <div key={i} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", fontSize: "0.825rem" }}>
                                          <span style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: "0.75rem", flexShrink: 0, paddingTop: "0.1rem" }}>
                                            {new Date(entry.timestamp).toLocaleString()}
                                          </span>
                                          <span style={{ color: "var(--accent-primary)", fontFamily: "var(--font-mono)", fontSize: "0.75rem", flexShrink: 0, paddingTop: "0.1rem" }}>
                                            {entry.action}
                                          </span>
                                          <span style={{ color: "var(--text-secondary)" }}>{entry.details}</span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>No audit events recorded.</p>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end" }}>
                      <button className="btn btn-secondary" onClick={loadSessions} disabled={sessionsLoading}>
                        {sessionsLoading ? <Spinner /> : <>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-4.93" /></svg>
                          Refresh
                        </>}
                      </button>
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
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
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
                        <CardHeader icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>} title="Rotate Encryption Key" subtitle="Update the symmetric master key for credential encryption" />
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
                              <button type="button" className="btn btn-secondary" onClick={() => setAesKey(generateHex(32))} style={{ flexShrink: 0, whiteSpace: "nowrap", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg> Generate
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
                        <CardHeader icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>} title="JWT Signature Config" subtitle="Cryptographic key used to verify user sessions" />
                        <InfoRow label="Active Secret" value={<code style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", background: "var(--bg-hover)", padding: "0.2rem 0.6rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>{settings?.jwt?.secretMasked ?? "••••••••"}</code>} />
                        <InfoRow label="Storage" value={<code style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", background: "var(--bg-hover)", padding: "0.2rem 0.6rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>MongoDB settings</code>} />
                      </Card>

                      {/* Rotate JWT */}
                      <Card>
                        <CardHeader icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>} title="Rotate JWT Secret" subtitle="Force all users to re-authenticate" />
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
                        <CardHeader icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>} title="MongoDB Configuration" subtitle="Active connection config for data persistence" />
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
                        <CardHeader icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>} title="Database Diagnostics" subtitle="Verify response latency and connection endpoints" />
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
                          { id: "dark", name: "Dark Mode", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>, desc: "Sleek dark layout with glassmorphism glow" },
                          { id: "light", name: "Light Mode", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>, desc: "Clean light layout with soft frosted details" },
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
                                <span className="theme-picker-label-name" style={{ display: "flex", alignItems: "center", gap: "6px" }}>{t.icon} {t.name}</span>
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
