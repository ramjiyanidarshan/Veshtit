"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import { getStatusOption } from "@/components/StatusDropdown";
import AppShell from "@/components/AppShell";
import ProviderIcon from "@/components/ProviderIcon";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Stats {
  totalAccounts: number;
  totalProviders: number;
  statusBreakdown: { Active: number; Disable: number; Deleted: number; Other: number };
  topProviders: { name: string; count: number }[];
  recentAccounts: { _id: string; serviceProvider: string; status: string; source: string; createdAt: string | null; updatedAt: string | null }[];
}

interface SecurityAudit {
  overallScore: number;
  scoreLabel: "Critical" | "Poor" | "Fair" | "Good" | "Excellent";
  rotationDays: number;
  summary: {
    total: number;
    veryWeak: number; weak: number; moderate: number; strong: number; veryStrong: number;
    needsRotation: number; duplicates: number;
  };
  issues: Array<{
    _id: string; provider: string; score: number; label: string;
    tips: string[]; daysSinceUpdate: number | null;
    needsRotation: boolean; isDuplicate: boolean;
  }>;
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────
async function fetchStats(): Promise<Stats> {
  const res = await fetch(`${BACKEND}/api/stats`, { credentials: "include" });
  if (res.status === 401) throw new ApiError(401, "Unauthorized");
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}

async function fetchAudit(): Promise<SecurityAudit> {
  const res = await fetch(`${BACKEND}/api/security/audit`, { credentials: "include" });
  if (!res.ok) throw new Error("Audit failed");
  return res.json();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function scoreColor(s: number) {
  if (s >= 80) return "#4ade80";
  if (s >= 60) return "#86efac";
  if (s >= 40) return "#fbbf24";
  if (s >= 20) return "#f97316";
  return "#f43f5e";
}
function scoreLabelColor(label: string) {
  return { Excellent: "#4ade80", Good: "#86efac", Fair: "#fbbf24", Poor: "#f97316", Critical: "#f43f5e" }[label] ?? "#6366f1";
}
function strengthColor(label: string) {
  return { "Very Strong": "#4ade80", Strong: "#86efac", Moderate: "#fbbf24", Weak: "#f97316", "Very Weak": "#f43f5e" }[label] ?? "#6366f1";
}

// ─── Security Score Ring ──────────────────────────────────────────────────────
function ScoreRing({ score, label }: { score: number; label: string }) {
  const r = 58, cx = 72, cy = 72;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const color = scoreColor(score);
  return (
    <svg viewBox="0 0 144 144" width="144" height="144" style={{ transform: "rotate(-90deg)" }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border-default)" strokeWidth="12" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="12"
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 1s ease, stroke 0.5s" }}
      />
      <circle cx={cx} cy={cy} r={50} fill="var(--bg-secondary)" />
      <text x={cx} y={cy - 6} textAnchor="middle" fill={color} fontSize="22" fontWeight="700"
        style={{ transform: "rotate(90deg)", transformOrigin: "72px 72px", fontFamily: "inherit" }}>
        {score}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="var(--text-muted)" fontSize="9"
        style={{ transform: "rotate(90deg)", transformOrigin: "72px 72px", fontFamily: "inherit", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </text>
    </svg>
  );
}

// ─── Donut chart (status breakdown) ──────────────────────────────────────────
interface DonutProps { active: number; disable: number; deleted: number; other: number; total: number; }
function DonutChart({ active, disable, deleted, other, total }: DonutProps) {
  const r = 52, cx = 64, cy = 64;
  const circ = 2 * Math.PI * r;
  const segments = [
    { value: active, color: "#4ade80" }, { value: disable, color: "#fbbf24" },
    { value: deleted, color: "#f43f5e" }, { value: other, color: "#6366f1" },
  ].filter((s) => s.value > 0);
  let offset = 0;
  return (
    <svg viewBox="0 0 128 128" width="128" height="128" style={{ transform: "rotate(-90deg)" }}>
      {total === 0 ? (
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border-default)" strokeWidth="16" />
      ) : segments.map((seg, i) => {
        const dash = (seg.value / total) * circ;
        const el = <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth="16"
          strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={-offset} />;
        offset += dash;
        return el;
      })}
      <circle cx={cx} cy={cy} r={42} fill="var(--bg-secondary)" />
    </svg>
  );
}

// ─── Strength mini-bar ────────────────────────────────────────────────────────
function StrengthBar({ score, label }: { score: number; label: string }) {
  const color = strengthColor(label);
  return (
    <div className="sec-strength-bar-wrap" title={`${label} (${score}/100)`}>
      <div className="sec-strength-bar-track">
        <div className="sec-strength-bar-fill" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="sec-strength-label" style={{ color }}>{label}</span>
    </div>
  );
}

// ─── Dashboard page ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [audit, setAudit] = useState<SecurityAudit | null>(null);
  const [loading, setLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(true);
  const [showAllIssues, setShowAllIssues] = useState(false);

  const load = useCallback(async () => {
    try { setStats(await fetchStats()); }
    catch (err) { if (err instanceof ApiError && err.status === 401) router.push("/login"); }
    finally { setLoading(false); }
  }, [router]);

  const loadAudit = useCallback(async () => {
    try { setAudit(await fetchAudit()); }
    catch { /* audit optional */ }
    finally { setAuditLoading(false); }
  }, []);

  useEffect(() => { load(); loadAudit(); }, [load, loadAudit]);

  const total = stats?.totalAccounts ?? 0;
  const sb = stats?.statusBreakdown ?? { Active: 0, Disable: 0, Deleted: 0, Other: 0 };

  const statCards = [
    { label: "Total Accounts", value: stats?.totalAccounts ?? 0, color: "var(--accent-primary)", bg: "var(--accent-primary-dim)",
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
    { label: "Providers", value: stats?.totalProviders ?? 0, color: "var(--accent-secondary)", bg: "var(--accent-secondary-dim)",
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg> },
    { label: "Active", value: sb.Active, color: "#4ade80", bg: "rgba(74,222,128,0.12)",
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> },
    { label: "Disabled", value: sb.Disable, color: "#fbbf24", bg: "rgba(251,191,36,0.12)",
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><line x1="10" y1="15" x2="10" y2="9"/><line x1="14" y1="15" x2="14" y2="9"/></svg> },
  ];

  const displayIssues = audit ? (showAllIssues ? audit.issues : audit.issues.slice(0, 5)) : [];
  const totalRisk = audit ? audit.issues.filter((a) => a.score < 40 || a.needsRotation || a.isDuplicate).length : 0;

  // Global security suggestions
  const suggestions: { icon: string; text: string; action?: string }[] = [];
  if (audit) {
    if (audit.summary.veryWeak + audit.summary.weak > 0)
      suggestions.push({ icon: "🔑", text: `${audit.summary.veryWeak + audit.summary.weak} accounts have weak passwords — update them immediately.` });
    if (audit.summary.needsRotation > 0)
      suggestions.push({ icon: "🕐", text: `${audit.summary.needsRotation} passwords haven't been changed in ${audit.rotationDays}+ days.`, action: "/accounts" });
    if (audit.summary.duplicates > 0)
      suggestions.push({ icon: "🔁", text: `${audit.summary.duplicates} accounts share the same password — use unique passwords.` });
    if (audit.overallScore < 60)
      suggestions.push({ icon: "🛡️", text: "Adjust your password rotation period in Settings → Security Policy." });
    if (audit.summary.veryStrong + audit.summary.strong > audit.summary.total * 0.7)
      suggestions.push({ icon: "✅", text: "Great job! Most of your passwords are strong." });
  }

  return (
    <AppShell>
      <div className="dashboard-page">
        {/* Header */}
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-title">Dashboard</h1>
            <p className="dashboard-subtitle">Your account security overview</p>
          </div>
          <button className="btn btn-primary" onClick={() => router.push("/accounts")} id="manage-accounts-btn">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="23" y1="11" x2="17" y2="11"/><line x1="20" y1="8" x2="20" y2="14"/></svg>
            Manage Accounts
          </button>
        </div>

        {loading ? (
          <div className="empty-state"><svg className="spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg></div>
        ) : (
          <>
            {/* Stat cards */}
            <div className="stat-cards-grid">
              {statCards.map((card) => (
                <div key={card.label} className="stat-card">
                  <div className="stat-card-icon" style={{ color: card.color, background: card.bg }}>{card.icon}</div>
                  <div className="stat-card-body">
                    <div className="stat-card-value" style={{ color: card.color }}>{card.value}</div>
                    <div className="stat-card-label">{card.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Security Score + Suggestions ──────────────────────────────── */}
            <div className="sec-panel">
              {/* Left: score ring + quick summary */}
              <div className="sec-score-col">
                <div className="dash-card-header" style={{ marginBottom: "1rem" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  Security Score
                </div>
                {auditLoading ? (
                  <div className="empty-state" style={{ minHeight: "160px" }}>
                    <svg className="spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  </div>
                ) : audit ? (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", marginBottom: "1.25rem" }}>
                      <ScoreRing score={audit.overallScore} label={audit.scoreLabel} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: "1.15rem", color: scoreLabelColor(audit.scoreLabel), marginBottom: "0.25rem" }}>
                          {audit.scoreLabel}
                        </div>
                        <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
                          Based on {audit.summary.total} accounts
                        </div>
                        <div className="sec-mini-stats">
                          {[
                            { label: "Weak", val: audit.summary.veryWeak + audit.summary.weak, color: "#f43f5e" },
                            { label: "Old", val: audit.summary.needsRotation, color: "#fbbf24" },
                            { label: "Duplicates", val: audit.summary.duplicates, color: "#f97316" },
                          ].map((s) => (
                            <div key={s.label} className="sec-mini-stat">
                              <div className="sec-mini-stat-val" style={{ color: s.color }}>{s.val}</div>
                              <div className="sec-mini-stat-label">{s.label}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Strength breakdown bars */}
                    <div className="sec-breakdown">
                      {([
                        ["Very Strong", audit.summary.veryStrong],
                        ["Strong",      audit.summary.strong],
                        ["Moderate",    audit.summary.moderate],
                        ["Weak",        audit.summary.weak],
                        ["Very Weak",   audit.summary.veryWeak],
                      ] as [string, number][]).map(([lbl, cnt]) => (
                        <div key={lbl} className="sec-breakdown-row">
                          <span className="sec-breakdown-label">{lbl}</span>
                          <div className="sec-breakdown-track">
                            <div className="sec-breakdown-fill" style={{
                              width: audit.summary.total > 0 ? `${(cnt / audit.summary.total) * 100}%` : "0%",
                              background: strengthColor(lbl),
                            }} />
                          </div>
                          <span className="sec-breakdown-count" style={{ color: strengthColor(lbl) }}>{cnt}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="empty-state" style={{ minHeight: "120px" }}>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Audit unavailable</p>
                  </div>
                )}
              </div>

              {/* Right: issues list + suggestions */}
              <div className="sec-issues-col">
                <div className="dash-card-header" style={{ marginBottom: "1rem" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  Accounts Needing Attention
                  {totalRisk > 0 && <span className="sec-risk-badge">{totalRisk}</span>}
                </div>

                {auditLoading ? (
                  <div className="empty-state" style={{ minHeight: "120px" }}><svg className="spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg></div>
                ) : audit && audit.issues.length > 0 ? (
                  <>
                    <div className="sec-issues-list">
                      {displayIssues.map((issue) => (
                        <div key={issue._id} className="sec-issue-row">
                          <div className="sec-issue-avatar" style={{ background: "transparent", border: "none" }}>
                            <ProviderIcon name={issue.provider} size={32} />
                          </div>
                          <div className="sec-issue-body">
                            <div className="sec-issue-provider">{issue.provider}</div>
                            <div className="sec-issue-flags">
                              {issue.isDuplicate && <span className="sec-flag sec-flag-dup">Duplicate</span>}
                              {issue.needsRotation && <span className="sec-flag sec-flag-old">{issue.daysSinceUpdate}d old</span>}
                              {issue.tips.slice(0, 1).map((t, i) => <span key={i} className="sec-flag sec-flag-tip">{t}</span>)}
                            </div>
                          </div>
                          <StrengthBar score={issue.score} label={issue.label} />
                        </div>
                      ))}
                    </div>
                    {audit.issues.length > 5 && (
                      <button className="btn btn-ghost btn-sm sec-show-more" onClick={() => setShowAllIssues(!showAllIssues)}>
                        {showAllIssues ? "Show less ↑" : `Show all ${audit.issues.length} accounts ↓`}
                      </button>
                    )}
                  </>
                ) : (
                  <div className="empty-state" style={{ minHeight: "120px", gap: "0.5rem" }}>
                    <div style={{ fontSize: "1.5rem" }}>🛡️</div>
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>All accounts look healthy!</p>
                  </div>
                )}

                {/* Suggestions */}
                {suggestions.length > 0 && (
                  <div className="sec-suggestions">
                    <div className="sec-suggestions-title">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      Recommendations
                    </div>
                    {suggestions.map((s, i) => (
                      <div key={i} className="sec-suggestion-row" onClick={() => s.action && router.push(s.action)}>
                        <span className="sec-suggestion-icon">{s.icon}</span>
                        <span className="sec-suggestion-text">{s.text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Mid row: status + top providers ───────────────────────────── */}
            <div className="dashboard-mid-row">
              <div className="dash-card">
                <div className="dash-card-header">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  Status Breakdown
                </div>
                <div className="donut-row">
                  <div style={{ position: "relative" }}>
                    <DonutChart active={sb.Active} disable={sb.Disable} deleted={sb.Deleted} other={sb.Other} total={total} />
                    <div className="donut-center-label">
                      <span className="donut-center-num">{total}</span>
                      <span className="donut-center-sub">TOTAL</span>
                    </div>
                  </div>
                  <div className="donut-legend">
                    {[
                      { label: "Active",  value: sb.Active,  color: "#4ade80" },
                      { label: "Disable", value: sb.Disable, color: "#fbbf24" },
                      { label: "Deleted", value: sb.Deleted, color: "#f43f5e" },
                      { label: "Other",   value: sb.Other,   color: "#6366f1" },
                    ].map((item) => (
                      <div key={item.label} className="donut-legend-item">
                        <div className="donut-legend-dot" style={{ background: item.color }} />
                        <span className="donut-legend-label">{item.label}</span>
                        <span className="donut-legend-value">{item.value}</span>
                        <span className="donut-legend-pct">{total > 0 ? `${Math.round((item.value / total) * 100)}%` : "0%"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="dash-card">
                <div className="dash-card-header">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                  Top Providers
                </div>
                {(stats?.topProviders ?? []).length === 0 ? (
                  <div className="empty-state" style={{ padding: "2rem" }}>
                    <div className="empty-state-icon">📊</div>
                    <p className="empty-state-desc">No data yet.</p>
                  </div>
                ) : (
                  <div className="provider-bars">
                    {(stats!.topProviders).map((p, idx) => {
                      const max = stats!.topProviders[0]?.count ?? 1;
                      return (
                        <div key={p.name} className="provider-bar-item">
                          <div className="provider-bar-avatar" style={{ background: "transparent", border: "none" }}>
                            <ProviderIcon name={p.name} size={30} />
                          </div>
                          <div className="provider-bar-body">
                            <div className="provider-bar-name-row">
                              <span className="provider-bar-name">{p.name}</span>
                              <span className="provider-bar-count">{p.count}</span>
                            </div>
                            <div className="provider-bar-track">
                              <div className="provider-bar-fill" style={{ width: `${Math.round((p.count / max) * 100)}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── Recently added ─────────────────────────────────────────────── */}
            <div className="dash-card">
              <div className="dash-card-header">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Recently Added
              </div>
              {(stats?.recentAccounts ?? []).length === 0 ? (
                <div className="empty-state" style={{ padding: "2rem" }}>
                  <div className="empty-state-icon">📭</div>
                  <p className="empty-state-desc">No accounts yet. Go to Accounts to create one.</p>
                </div>
              ) : (
                <div className="recent-table">
                  <div className="recent-table-header">
                    <span>Provider</span>
                    <span>Source</span>
                    <span>Status</span>
                    <span>Added</span>
                  </div>
                  {stats!.recentAccounts.map((a) => {
                    const opt = getStatusOption(a.status);
                    const isImport = a.source === "import";
                    return (
                      <div key={a._id} className="recent-table-row">
                        <div className="recent-provider">
                          <div className="recent-provider-avatar" style={{ background: "transparent", border: "none" }}>
                            <ProviderIcon name={a.serviceProvider} size={28} />
                          </div>
                          <span className="recent-provider-name">{a.serviceProvider}</span>
                        </div>
                        <span className="source-badge" data-import={isImport}>
                          {isImport
                            ? <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>Import</>
                            : <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Manual</>
                          }
                        </span>
                        <span className="status-badge-inline" style={{ color: opt.color, background: opt.bg, border: `1px solid ${opt.border}` }}>
                          <span className="status-dot" style={{ background: opt.color }} />{a.status}
                        </span>
                        <span className="recent-date">{formatDate(a.createdAt)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
