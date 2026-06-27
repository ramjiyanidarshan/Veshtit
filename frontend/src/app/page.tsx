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
  hibpAvailable?: boolean;
  summary: {
    total: number;
    veryWeak: number; weak: number; moderate: number; strong: number; veryStrong: number;
    needsRotation: number; duplicates: number; breached?: number;
  };
  issues: Array<{
    _id: string; provider: string; title?: string | null; score: number; label: string;
    tips: string[]; daysSinceUpdate: number | null;
    needsRotation: boolean; isDuplicate: boolean; isBreached?: boolean; breachCount?: number;
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

// ─── Score Colors ─────────────────────────────────────────────────────────────
function scoreColor(s: number) {
  if (s >= 80) return "#10b981"; // Emerald green
  if (s >= 60) return "#34d399"; // Lighter green
  if (s >= 40) return "#f59e0b"; // Warning orange
  if (s >= 20) return "#f97316"; // Deep orange
  return "#ef4444"; // Red
}

function scoreLabelColor(label: string) {
  return { Excellent: "#10b981", Good: "#34d399", Fair: "#f59e0b", Poor: "#f97316", Critical: "#ef4444" }[label] ?? "#FF6B35";
}

function strengthColor(label: string) {
  return { "Very Strong": "#10b981", Strong: "#34d399", Moderate: "#fbbf24", Weak: "#f97316", "Very Weak": "#ef4444" }[label] ?? "#FF6B35";
}

// ─── Security Score Ring ──────────────────────────────────────────────────────
function ScoreRing({ score, label }: { score: number; label: string }) {
  const r = 54, cx = 72, cy = 72;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const color = scoreColor(score);
  return (
    <div className="score-ring-wrap" style={{ position: "relative", width: "136px", height: "136px" }}>
      <svg viewBox="0 0 144 144" width="136" height="136" style={{ transform: "rotate(-90deg)" }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border-subtle)" strokeWidth="10" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1s ease, stroke 0.5s", filter: `drop-shadow(0 0 4px ${color}40)` }}
        />
      </svg>
      <div className="premium-donut-center">
        <span className="premium-donut-num" style={{ color }}>{score}</span>
        <span className="premium-donut-label">{label}</span>
      </div>
    </div>
  );
}

// ─── Donut chart (status breakdown) ──────────────────────────────────────────
interface DonutProps { active: number; disable: number; deleted: number; other: number; total: number; }
function DonutChart({ active, disable, deleted, other, total }: DonutProps) {
  const r = 48, cx = 64, cy = 64;
  const circ = 2 * Math.PI * r;
  const segments = [
    { value: active, color: "#10b981" }, { value: disable, color: "#fbbf24" },
    { value: deleted, color: "#ef4444" }, { value: other, color: "#FF6B35" },
  ].filter((s) => s.value > 0);
  let offset = 0;
  return (
    <svg viewBox="0 0 128 128" width="128" height="128" style={{ transform: "rotate(-90deg)" }}>
      {total === 0 ? (
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border-subtle)" strokeWidth="12" />
      ) : segments.map((seg, i) => {
        const dash = (seg.value / total) * circ;
        const el = <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth="12"
          strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={-offset} strokeLinecap="round" />;
        offset += dash;
        return el;
      })}
    </svg>
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
  const [activeTab, setActiveTab] = useState<"score" | "status">("score");

  const load = useCallback(async () => {
    try { 
      setStats(await fetchStats()); 
    } catch (err) { 
      if (err instanceof ApiError && err.status === 401) {
        router.push("/login"); 
      }
    } finally { 
      setLoading(false); 
    }
  }, [router]);

  const loadAudit = useCallback(async () => {
    try { 
      setAudit(await fetchAudit()); 
    } catch { 
      /* audit is optional */ 
    } finally { 
      setAuditLoading(false); 
    }
  }, []);

  useEffect(() => { 
    load(); 
    loadAudit(); 
  }, [load, loadAudit]);

  const total = stats?.totalAccounts ?? 0;
  const sb = stats?.statusBreakdown ?? { Active: 0, Disable: 0, Deleted: 0, Other: 0 };
  const breachedCount = audit?.summary.breached ?? 0;

  const statCards = [
    { 
      label: "Total Accounts", 
      value: stats?.totalAccounts ?? 0, 
      colorClass: "stat-primary",
      filterParam: "",
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> 
    },
    { 
      label: "Unique Providers", 
      value: stats?.totalProviders ?? 0, 
      colorClass: "stat-secondary",
      filterParam: "",
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg> 
    },
    { 
      label: "Active Credentials", 
      value: sb.Active, 
      colorClass: "stat-success",
      filterParam: "?filter=Active",
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> 
    },
    {
      label: "Disabled Entries",
      value: sb.Disable,
      colorClass: "stat-warning",
      filterParam: "?filter=Disable",
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="10" y1="15" x2="10" y2="9"/><line x1="14" y1="15" x2="14" y2="9"/></svg>
    },
    {
      label: "Breached Passwords",
      value: breachedCount,
      colorClass: breachedCount > 0 ? "stat-danger" : "stat-success",
      filterParam: "",
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
    },
  ];

  const displayIssues = audit ? (showAllIssues ? audit.issues : audit.issues.slice(0, 5)) : [];
  const totalRisk = audit ? audit.issues.filter((a) => a.score < 40 || a.needsRotation || a.isDuplicate || a.isBreached).length : 0;

  // Global security suggestions - updated to link straight to the accounts list filters
  const suggestions: { icon: React.ReactNode; text: string; action: string; actionText: string }[] = [];
  if (audit) {
    if (audit.summary.veryWeak + audit.summary.weak > 0) {
      suggestions.push({ 
        icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5l-.5-.5"/></svg>, 
        text: `${audit.summary.veryWeak + audit.summary.weak} accounts have weak passwords. Update them to improve security.`,
        action: "/accounts?filter=weak",
        actionText: "Fix Passwords"
      });
    }
    if (audit.summary.needsRotation > 0) {
      suggestions.push({ 
        icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, 
        text: `${audit.summary.needsRotation} passwords haven't been rotated in ${audit.rotationDays}+ days.`,
        action: "/accounts?filter=old",
        actionText: "Rotate Credentials"
      });
    }
    if (audit.summary.duplicates > 0) {
      suggestions.push({
        icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>,
        text: `${audit.summary.duplicates} accounts share identical passwords. Use unique values for each.`,
        action: "/accounts?filter=duplicate",
        actionText: "Resolve Duplicates"
      });
    }
    if ((audit.summary.breached ?? 0) > 0) {
      suggestions.push({
        icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
        text: `${audit.summary.breached} password${audit.summary.breached === 1 ? " has" : "s have"} been found in known data breaches. Change them immediately.`,
        action: "/accounts",
        actionText: "Update Breached",
      });
    }
  }

  return (
    <AppShell>
      <div className="main-panel font-sans" style={{ flex: 1, overflowY: "auto" }}>
        {/* Full-width header mirroring Accounts page */}
        <div className="main-panel-header">
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <h2 className="main-panel-title" style={{ fontSize: "1.45rem", fontWeight: 700, margin: 0 }}>Security Health Center</h2>
            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: 0 }}>Overview of your credential security audits and provider statistics</p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => router.push("/accounts")} id="manage-accounts-btn" style={{ marginLeft: "auto" }}>
            <svg style={{ marginRight: "6px" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="23" y1="11" x2="17" y2="11"/><line x1="20" y1="8" x2="20" y2="14"/></svg>
            Manage Accounts
          </button>
        </div>

        <div className="main-panel-body" style={{ display: "flex", flexDirection: "column", gap: "1.75rem", padding: "1.75rem" }}>
          {loading ? (
            <div className="empty-state" style={{ padding: "4rem" }}>
              <svg className="spin" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              <p style={{ color: "var(--text-muted)", marginTop: "1rem" }}>Gathering dashboard metrics...</p>
            </div>
          ) : (
            <>
              {/* Stat Cards Grid (Redesigned & Full-bleed) */}
              <div className="premium-stat-grid">
                {statCards.map((card) => (
                  <div 
                    key={card.label} 
                    className={`premium-stat-card ${card.colorClass}`}
                    onClick={() => router.push(`/accounts${card.filterParam}`)}
                  >
                    <div className="premium-stat-icon-wrapper">{card.icon}</div>
                    <div>
                      <div className="premium-stat-number">{card.value}</div>
                      <div className="premium-stat-label">{card.label}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Main Security Hub */}
              <div className="dash-grid-layout dash-grid-layout-two-col">
                {/* Left: Combined Security Score & Status Distribution */}
                <div className="premium-card card-accent-primary" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                  <div className="dash-card-header" style={{ marginBottom: "1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                      Security &amp; Status
                    </span>
                  </div>

                  {/* Tab Switcher */}
                  <div style={{ display: "flex", gap: "0.35rem", marginBottom: "1.25rem", background: "rgba(255,255,255,0.03)", padding: "3px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                    <button
                      className={`btn btn-sm ${activeTab === "score" ? "btn-primary" : "btn-ghost"}`}
                      style={{ flex: 1, padding: "0.35rem 0.5rem", fontSize: "0.78rem", borderRadius: "var(--radius-sm)", height: "30px", border: activeTab === "score" ? undefined : "none", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
                      onClick={() => setActiveTab("score")}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                      Score
                    </button>
                    <button
                      className={`btn btn-sm ${activeTab === "status" ? "btn-primary" : "btn-ghost"}`}
                      style={{ flex: 1, padding: "0.35rem 0.5rem", fontSize: "0.78rem", borderRadius: "var(--radius-sm)", height: "30px", border: activeTab === "status" ? undefined : "none", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
                      onClick={() => setActiveTab("status")}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                      Status
                    </button>
                  </div>

                  {activeTab === "score" ? (
                    auditLoading ? (
                      <div className="empty-state" style={{ flex: 1, minHeight: "220px" }}>
                        <svg className="spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                      </div>
                    ) : audit ? (
                      <div className="premium-score-wrapper" style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: "1.5rem" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                          <ScoreRing score={audit.overallScore} label={audit.scoreLabel} />
                          <div className="premium-score-text" style={{ color: scoreLabelColor(audit.scoreLabel) }}>
                            {audit.scoreLabel} Health status
                          </div>
                          <p className="premium-score-desc">
                            Calculated from password complexity and age analysis of your {audit.summary.total} accounts.
                          </p>
                        </div>

                        {/* Score category details */}
                        <div className="sec-breakdown" style={{ width: "100%", marginTop: "1.5rem" }}>
                          {([
                            ["Very Strong", audit.summary.veryStrong],
                            ["Strong",      audit.summary.strong],
                            ["Moderate",    audit.summary.moderate],
                            ["Weak",        audit.summary.weak],
                            ["Very Weak",   audit.summary.veryWeak],
                          ] as [string, number][]).map(([lbl, cnt]) => (
                            <div key={lbl} className="sec-breakdown-row" style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.8rem" }}>
                              <span className="sec-breakdown-label" style={{ width: "80px", color: "var(--text-secondary)" }}>{lbl}</span>
                              <div className="sec-breakdown-track" style={{ flex: 1, height: "6px", background: "var(--border-subtle)", borderRadius: "3px", overflow: "hidden" }}>
                                <div className="sec-breakdown-fill" style={{
                                  height: "100%",
                                  width: audit.summary.total > 0 ? `${(cnt / audit.summary.total) * 100}%` : "0%",
                                  background: strengthColor(lbl),
                                  borderRadius: "3px"
                                }} />
                              </div>
                              <span className="sec-breakdown-count" style={{ width: "20px", textAlign: "right", fontWeight: 700, color: strengthColor(lbl) }}>{cnt}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="empty-state" style={{ flex: 1, minHeight: "220px" }}>
                        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Failed to retrieve security audit data</p>
                      </div>
                    )
                  ) : (
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", flexDirection: "column", gap: "1.5rem", padding: "0.5rem 0" }}>
                        <div style={{ position: "relative", width: "128px", height: "128px" }}>
                          <DonutChart active={sb.Active} disable={sb.Disable} deleted={sb.Deleted} other={sb.Other} total={total} />
                          <div className="premium-donut-center">
                            <span className="premium-donut-num">{total}</span>
                            <span className="premium-donut-label">Total</span>
                          </div>
                        </div>

                        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                          {[
                            { label: "Active",  value: sb.Active,  color: "#10b981", param: "?filter=Active" },
                            { label: "Disable", value: sb.Disable, color: "#fbbf24", param: "?filter=Disable" },
                            { label: "Deleted", value: sb.Deleted, color: "#ef4444", param: "?filter=Deleted" },
                            { label: "Other",   value: sb.Other,   color: "#FF6B35", param: "" },
                          ].map((item) => (
                            <div 
                              key={item.label} 
                              className="premium-rec-item" 
                              style={{ padding: "0.5rem 0.75rem", border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center" }}
                              onClick={() => router.push(`/accounts${item.param}`)}
                            >
                              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: item.color, marginRight: "0.5rem", flexShrink: 0 }} />
                              <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", flex: 1 }}>{item.label}</span>
                              <span style={{ fontWeight: 700, fontSize: "0.85rem", marginRight: "0.5rem" }}>{item.value}</span>
                              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                ({total > 0 ? Math.round((item.value / total) * 100) : 0}%)
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Accounts Needing Attention */}
                <div className="premium-card card-accent-danger" style={{ height: "100%" }}>
                  <div className="dash-card-header" style={{ marginBottom: "1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                      Accounts Needing Attention
                    </div>
                    {totalRisk > 0 && <span className="sec-risk-badge">{totalRisk} urgent</span>}
                  </div>

                  {auditLoading ? (
                    <div className="empty-state" style={{ minHeight: "200px" }}>
                      <svg className="spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    </div>
                  ) : audit && audit.issues.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                      <div className="interactive-item-list">
                        {displayIssues.map((issue) => (
                          <div 
                            key={issue._id} 
                            className="interactive-item-row"
                            onClick={() => router.push(`/accounts?provider=${encodeURIComponent(issue.provider)}`)}
                            title="Click to locate this account"
                          >
                            <div className="issue-row-main" style={{ display: "flex", alignItems: "center", gap: "0.85rem", flex: 1, minWidth: 0 }}>
                              <ProviderIcon name={issue.provider} size={36} />
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontWeight: 600, fontSize: "0.92rem", color: "var(--text-primary)" }}>
                                  {issue.provider} {issue.title ? `(${issue.title})` : ""}
                                </div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginTop: "4px" }}>
                                  {issue.isBreached && <span className="premium-tag premium-tag-danger">Breached {issue.breachCount && issue.breachCount > 1 ? `(${issue.breachCount.toLocaleString()}×)` : ""}</span>}
                                  {issue.isDuplicate && <span className="premium-tag premium-tag-danger">Duplicate</span>}
                                  {issue.needsRotation && <span className="premium-tag premium-tag-warning">Outdated ({issue.daysSinceUpdate}d old)</span>}
                                  {issue.tips.slice(0, 1).map((t, idx) => (
                                    <span key={idx} className="premium-tag premium-tag-info">{t}</span>
                                  ))}
                                </div>
                              </div>
                            </div>

                            <div className="issue-row-strength" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px", paddingRight: "0.5rem" }}>
                              <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: strengthColor(issue.label) }}>{issue.label}</span>
                              <div style={{ width: "80px", height: "4px", background: "var(--border-subtle)", borderRadius: "2px", overflow: "hidden" }}>
                                <div style={{ width: `${issue.score}%`, height: "100%", background: strengthColor(issue.label) }} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {audit.issues.length > 5 && (
                        <button 
                          className="btn btn-ghost btn-sm" 
                          style={{ alignSelf: "center", color: "var(--text-muted)" }} 
                          onClick={() => setShowAllIssues(!showAllIssues)}
                        >
                          {showAllIssues ? "Show Less ↑" : `Show All ${audit.issues.length} Issues ↓`}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="empty-state" style={{ minHeight: "200px" }}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.5" style={{ marginBottom: "0.5rem" }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                      <p style={{ color: "#10b981", fontWeight: 600, fontSize: "0.9rem", margin: 0 }}>All accounts look healthy!</p>
                      <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", margin: "4px 0 0" }}>No weak, duplicate, or expired passwords detected.</p>
                    </div>
                  )}

                  {/* Recommendations Actions section */}
                  {suggestions.length > 0 && (
                    <div className="premium-rec-box">
                      <div className="premium-rec-title">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        Recommendations
                      </div>
                      <div className="premium-rec-grid">
                        {suggestions.map((s, idx) => (
                          <div 
                            key={idx} 
                            className="premium-rec-item"
                            onClick={() => router.push(s.action)}
                          >
                            <span className="premium-rec-icon">{s.icon}</span>
                            <span className="premium-rec-text">{s.text}</span>
                            <span className="premium-rec-link">{s.actionText} →</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Mid Row: Top Providers & Recent Activities */}
              <div className="dash-grid-layout dash-grid-layout-half">
                {/* Top Providers list */}
                <div className="premium-card">
                  <div className="dash-card-header" style={{ marginBottom: "1.5rem" }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                    Top Service Providers
                  </div>

                  {(stats?.topProviders ?? []).length === 0 ? (
                    <div className="empty-state" style={{ minHeight: "180px" }}>
                      <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>No service providers logged yet</p>
                    </div>
                  ) : (
                    <div className="premium-provider-bars">
                      {stats!.topProviders.map((p) => {
                        const max = stats!.topProviders[0]?.count ?? 1;
                        return (
                          <div 
                            key={p.name} 
                            className="premium-provider-row"
                            onClick={() => router.push(`/accounts?provider=${encodeURIComponent(p.name)}`)}
                            title="Click to view details"
                          >
                            <ProviderIcon name={p.name} size={32} />
                            <div className="premium-provider-info">
                              <div className="premium-provider-header">
                                <span className="premium-provider-name">{p.name}</span>
                                <span className="premium-provider-count">{p.count} {p.count === 1 ? "account" : "accounts"}</span>
                              </div>
                              <div className="premium-provider-track">
                                <div className="premium-provider-fill" style={{ width: `${Math.round((p.count / max) * 100)}%` }} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Recently added Credentials Activity Log */}
                <div className="premium-card">
                  <div className="dash-card-header" style={{ marginBottom: "1.25rem" }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    Recent Activities &amp; Credential Logs
                  </div>

                  {(stats?.recentAccounts ?? []).length === 0 ? (
                    <div className="empty-state" style={{ padding: "3rem" }}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" style={{ marginBottom: "0.5rem" }}><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
                      <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Your vault is empty. Added credentials will appear here.</p>
                    </div>
                  ) : (
                    <div className="activity-feed">
                      {stats!.recentAccounts.map((a) => {
                        const opt = getStatusOption(a.status);
                        const isImport = a.source === "import";
                        return (
                          <div 
                            key={a._id} 
                            className="activity-row"
                            onClick={() => router.push(`/accounts?provider=${encodeURIComponent(a.serviceProvider)}`)}
                          >
                            <div className="activity-provider-info">
                              <ProviderIcon name={a.serviceProvider} size={30} />
                              <span className="activity-name">{a.serviceProvider}</span>
                            </div>

                            <div className="activity-meta">
                              <span className={`premium-tag ${isImport ? "premium-tag-info" : "premium-tag-success"}`} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                {isImport ? "Imported" : "Manual"}
                              </span>
                              <span className="status-badge-inline" style={{ color: opt.color, background: opt.bg, border: `1px solid ${opt.border}`, padding: "0.2rem 0.6rem", borderRadius: "99px", display: "flex", alignItems: "center", gap: "4px" }}>
                                <span className="status-dot" style={{ background: opt.color, width: "6px", height: "6px", borderRadius: "50%" }} />
                                {a.status}
                              </span>
                              <span className="activity-time" suppressHydrationWarning>{formatDate(a.createdAt)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
