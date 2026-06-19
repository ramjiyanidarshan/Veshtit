"use client";

import { useState } from "react";
import type { Account } from "@/lib/types";
import { getStatusOption } from "./StatusDropdown";
import ProviderIcon from "./ProviderIcon";

interface AccountDetailProps {
  accounts: Account[];
  providerName: string;
  onEdit: (account: Account) => void;
  onDelete: (account: Account) => void;
  onAddNew: () => void;
  onBack: () => void;
}

const PASSWORD_KEYS = ["password", "passwd", "pass", "secret", "pin", "key"];

function isPasswordKey(key: string): boolean {
  return PASSWORD_KEYS.some((p) => key.toLowerCase().includes(p));
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getFirstUrl(account: Account) {
  if (account.attributes["Url"] || account.attributes["URL"] || account.attributes["url"]) {
    return account.attributes["Url"] || account.attributes["URL"] || account.attributes["url"];
  }
  return null;
}

interface AttributeValueProps {
  attrKey: string;
  value: string | null;
}

function AttributeValue({ attrKey, value }: AttributeValueProps) {
  const [revealed, setRevealed] = useState(false);
  const isPass = isPasswordKey(attrKey);
  const isStatus = attrKey.toLowerCase() === "status" && value !== null;

  if (value === null) {
    return <span className="attribute-value is-null">null</span>;
  }

  if (isStatus) {
    const opt = getStatusOption(value);
    return (
      <span
        className="status-badge-inline"
        style={{ color: opt.color, background: opt.bg, border: `1px solid ${opt.border}` }}
      >
        <span className="status-dot" style={{ background: opt.color }} />
        {value}
      </span>
    );
  }

  if (isPass) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span
          className={`attribute-value is-password font-mono`}
          style={{ letterSpacing: revealed ? "normal" : "0.2em" }}
          title={revealed ? value : "Click to reveal"}
        >
          {revealed ? value : "••••••••••••"}
        </span>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setRevealed((r) => !r)}
          title={revealed ? "Hide" : "Reveal"}
          style={{ padding: "2px 6px" }}
        >
          {revealed ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => navigator.clipboard.writeText(value)}
          title="Copy to clipboard"
          style={{ padding: "2px 6px" }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <span className="attribute-value font-mono">{value}</span>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => navigator.clipboard.writeText(value)}
        title="Copy"
        style={{ padding: "2px 6px", opacity: 0.5 }}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      </button>
    </div>
  );
}

interface PasswordHistoryCollapseProps {
  history: { password: string; changedAt: string }[];
}

function PasswordHistoryCollapse({ history }: PasswordHistoryCollapseProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", marginTop: "0.25rem" }}>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        style={{
          padding: "2px 6px",
          fontSize: "0.725rem",
          alignSelf: "flex-start",
          display: "flex",
          alignItems: "center",
          gap: "4px",
          color: "var(--text-secondary)",
        }}
        onClick={() => setIsOpen(!isOpen)}
        title="Show previous passwords"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        {isOpen ? "Hide History" : `History (${history.length})`}
      </button>
      
      {isOpen && (
        <div
          className="password-history-list"
          style={{
            marginTop: "0.5rem",
            padding: "0.625rem 0.75rem",
            background: "rgba(0, 0, 0, 0.15)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-subtle)",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>
            Previous Passwords
          </div>
          {history.slice().reverse().map((h, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "1rem",
                paddingBottom: i < history.length - 1 ? "0.375rem" : "0",
                borderBottom: i < history.length - 1 ? "1px solid rgba(255, 255, 255, 0.04)" : "none",
              }}
            >
              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                {new Date(h.changedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}:
              </span>
              <AttributeValue attrKey="password" value={h.password} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AccountDetail({
  accounts,
  providerName,
  onEdit,
  onDelete,
  onAddNew,
  onBack,
}: AccountDetailProps) {
  if (accounts.length === 0) {
    return (
      <div className="main-panel">
      <div className="main-panel-header">
          {/* Mobile back button */}
          <button
            className="btn btn-ghost btn-sm btn-icon back-btn"
            onClick={onBack}
            aria-label="Back to providers"
            style={{ marginRight: "0.25rem" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h2 className="main-panel-title">{providerName}</h2>
          <button id="add-account-btn" className="btn btn-primary btn-sm" onClick={onAddNew}>
            + Add Account
          </button>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <p className="empty-state-title">No accounts</p>
          <p className="empty-state-desc">
            No accounts for {providerName} yet. Add one to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="main-panel">
      <div className="main-panel-header">
        {/* Mobile back button */}
        <button
          className="btn btn-ghost btn-sm btn-icon back-btn"
          onClick={onBack}
          aria-label="Back to providers"
          style={{ marginRight: "0.25rem" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div style={{ marginRight: 12 }}>
          <ProviderIcon name={providerName} size={36} />
        </div>
        <h2 className="main-panel-title">{providerName}</h2>
        <span className="text-xs text-muted">
          {accounts.length} account{accounts.length !== 1 ? "s" : ""}
        </span>
        <button id="add-account-for-provider-btn" className="btn btn-primary btn-sm" onClick={onAddNew}>
          + Add Account
        </button>
      </div>

      <div className="main-panel-body">
        <div className="accounts-grid">
        {accounts.map((account, idx) => (
          <div key={account._id} className="account-card" id={`account-card-${account._id}`}>
            <div className="account-card-header">
              <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                <ProviderIcon name={providerName} url={getFirstUrl(account)} size={32} />
                <div>
                  <div style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                    Account {idx + 1}
                  </div>
                  <div className="account-card-meta">
                    Added {formatDate(account.createdAt)}
                    {account.updatedAt !== account.createdAt && (
                      <> · Updated {formatDate(account.updatedAt)}</>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                {/* Status badge — top-right of card */}
                {(() => {
                  const statusEntry = Object.entries(account.attributes).find(
                    ([k]) => k.toLowerCase() === "status"
                  );
                  if (!statusEntry || !statusEntry[1]) return null;
                  const opt = getStatusOption(statusEntry[1]);
                  return (
                    <span
                      className="status-badge-inline"
                      style={{ color: opt.color, background: opt.bg, border: `1px solid ${opt.border}` }}
                    >
                      <span className="status-dot" style={{ background: opt.color }} />
                      {statusEntry[1]}
                    </span>
                  );
                })()}

                <div style={{ display: "flex", gap: "0.375rem" }}>
                <button
                  id={`edit-account-${account._id}`}
                  className="btn btn-secondary btn-sm"
                  onClick={() => onEdit(account)}
                  title="Edit account"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Edit
                </button>
                <button
                  id={`delete-account-${account._id}`}
                  className="btn btn-danger btn-sm"
                  onClick={() => onDelete(account)}
                  title="Delete account"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                  Delete
                </button>
                </div>
              </div>
            </div>

            <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "0.75rem" }}>
              {Object.entries(account.attributes)
                .filter(([key]) => key.toLowerCase() !== "status")
                .map(([key, value]) => {
                  const isPass = isPasswordKey(key);
                  return (
                    <div key={key} style={{ display: "flex", flexDirection: "column" }}>
                      <div className="attribute-row">
                        <span className="attribute-key">{key}</span>
                        <AttributeValue attrKey={key} value={value} />
                      </div>
                      {isPass && account.passwordHistory && account.passwordHistory.length > 0 && (
                        <div className="history-wrapper">
                          <PasswordHistoryCollapse history={account.passwordHistory} />
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
        </div>
      </div>
    </div>
  );
}
