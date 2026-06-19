"use client";

import { useState, useEffect } from "react";
import type { Account } from "@/lib/types";
import StatusDropdown from "./StatusDropdown";
import type { StatusValue } from "./StatusDropdown";
import ProviderIcon from "./ProviderIcon";

interface AttributeRow {
  key: string;
  value: string;
}

interface AccountFormProps {
  id?: string;
  initialData?: Account | null;
  initialProvider?: string;
  onSubmit: (
    serviceProvider: string,
    attributes: Record<string, string | null>
  ) => Promise<void>;
}

function isSensitiveField(key: string): boolean {
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

// ── Per-card sub-component so each manages its own reveal state ───────────────
interface AttrFieldCardProps {
  row: AttributeRow;
  idx: number;
  onKeyChange: (v: string) => void;
  onValueChange: (v: string) => void;
  onRemove: () => void;
  onGenerate: () => void;
}

function AttrFieldCard({
  row,
  idx,
  onKeyChange,
  onValueChange,
  onRemove,
  onGenerate,
}: AttrFieldCardProps) {
  const [revealed, setRevealed] = useState(false);
  const sensitive = isSensitiveField(row.key);

  return (
    <div className="attr-field-card">
      {/* ── Key row ── */}
      <div className="attr-field-key-row">
        <input
          type="text"
          className="attr-field-key-input"
          placeholder="Field name (e.g. E-Mail, Password)"
          value={row.key}
          onChange={(e) => onKeyChange(e.target.value)}
          id={`attr-key-${idx}`}
        />
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", paddingRight: "0.25rem" }}>
          {sensitive && (
            <span className="attr-encrypted-badge">
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              enc.
            </span>
          )}
          {sensitive && (
            <button
              type="button"
              className="btn btn-ghost btn-sm attr-generate-btn"
              onClick={onGenerate}
              title="Generate secure value"
              id={`generate-pw-btn-${idx}`}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="2" width="20" height="20" rx="3" ry="3" />
                <circle cx="8.5" cy="9" r="1.5" fill="currentColor" stroke="none" />
                <circle cx="15.5" cy="9" r="1.5" fill="currentColor" stroke="none" />
                <circle cx="8.5" cy="15" r="1.5" fill="currentColor" stroke="none" />
                <circle cx="15.5" cy="15" r="1.5" fill="currentColor" stroke="none" />
                <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
              </svg>
              Generate
            </button>
          )}
          <button
            type="button"
            className="btn btn-danger btn-sm btn-icon attr-field-remove"
            onClick={onRemove}
            title="Remove field"
            id={`remove-attr-${idx}`}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="attr-field-divider" />

      {/* ── Value row ── */}
      <div style={{ position: "relative" }}>
        <input
          type={sensitive && !revealed ? "password" : "text"}
          className={`attr-field-value-input form-input mono${sensitive ? " has-reveal" : ""}`}
          placeholder={sensitive ? "Value — stored encrypted" : "Value (leave empty for null)"}
          value={row.value}
          onChange={(e) => onValueChange(e.target.value)}
          id={`attr-value-${idx}`}
          autoComplete={sensitive ? "new-password" : "off"}
        />
        {sensitive && (
          <button
            type="button"
            className="attr-reveal-btn"
            onClick={() => setRevealed((r) => !r)}
            title={revealed ? "Hide value" : "Reveal value"}
            tabIndex={-1}
          >
            {revealed ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────
export default function AccountForm({
  id = "account-form",
  initialData,
  initialProvider = "",
  onSubmit,
}: AccountFormProps) {
  const [serviceProvider, setServiceProvider] = useState(
    initialData?.serviceProvider ?? initialProvider
  );
  const [rows, setRows] = useState<AttributeRow[]>([]);
  const [status, setStatus] = useState<StatusValue>("Active");
  const [error, setError] = useState("");
  const [genRules, setGenRules] = useState({
    length: 16,
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
  });

  const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

  useEffect(() => {
    fetch(`${BACKEND}/api/settings`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data?.generator) setGenRules(data.generator);
      })
      .catch(() => {});
  }, [BACKEND]);

  function handleGeneratePassword(idx: number) {
    const upperChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowerChars = "abcdefghijklmnopqrstuvwxyz";
    const numberChars = "0123456789";
    const symbolChars = "!@#$%^&*()_+-=[]{}|;:,.<>?";

    let charPool = "";
    const mandatoryChars: string[] = [];

    const getSecureRandomChar = (pool: string) => {
      const arr = new Uint32Array(1);
      window.crypto.getRandomValues(arr);
      return pool[arr[0] % pool.length];
    };

    if (genRules.uppercase) { charPool += upperChars; mandatoryChars.push(getSecureRandomChar(upperChars)); }
    if (genRules.lowercase) { charPool += lowerChars; mandatoryChars.push(getSecureRandomChar(lowerChars)); }
    if (genRules.numbers)   { charPool += numberChars; mandatoryChars.push(getSecureRandomChar(numberChars)); }
    if (genRules.symbols)   { charPool += symbolChars; mandatoryChars.push(getSecureRandomChar(symbolChars)); }

    if (!charPool) { charPool = lowerChars; mandatoryChars.push(getSecureRandomChar(lowerChars)); }

    let password = [...mandatoryChars];
    const remainingLength = Math.max(0, genRules.length - mandatoryChars.length);

    if (remainingLength > 0) {
      const randomIndices = new Uint32Array(remainingLength);
      window.crypto.getRandomValues(randomIndices);
      for (let i = 0; i < remainingLength; i++) {
        password.push(charPool[randomIndices[i] % charPool.length]);
      }
    }

    const shuffleIndices = new Uint32Array(password.length);
    window.crypto.getRandomValues(shuffleIndices);
    for (let i = password.length - 1; i > 0; i--) {
      const j = shuffleIndices[i] % (i + 1);
      [password[i], password[j]] = [password[j], password[i]];
    }

    updateRow(idx, "value", password.join(""));
  }

  useEffect(() => {
    if (initialData?.attributes) {
      const statusVal =
        Object.entries(initialData.attributes).find(
          ([k]) => k.toLowerCase() === "status"
        )?.[1] ?? "Active";
      setStatus((statusVal as StatusValue) ?? "Active");
      setRows(
        Object.entries(initialData.attributes)
          .filter(([k]) => k.toLowerCase() !== "status")
          .map(([key, value]) => ({ key, value: value ?? "" }))
      );
    } else {
      setRows([
        { key: "E-Mail", value: "" },
        { key: "Password", value: "" },
      ]);
    }
  }, [initialData]);

  function addRow() {
    setRows((prev) => [...prev, { key: "", value: "" }]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function updateRow(index: number, field: "key" | "value", newValue: string) {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: newValue } : row))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!serviceProvider.trim()) {
      setError("Service provider name is required");
      return;
    }

    const keys = rows.map((r) => r.key.trim()).filter(Boolean);
    if (new Set(keys).size !== keys.length) {
      setError("Duplicate attribute keys are not allowed");
      return;
    }

    const attributes: Record<string, string | null> = {};
    for (const row of rows) {
      const k = row.key.trim();
      if (!k) continue;
      attributes[k] = row.value.trim() === "" ? null : row.value.trim();
    }
    attributes["Status"] = status;

    await onSubmit(serviceProvider.trim(), attributes);
  }

  return (
    <form id={id} onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {error && <div className="login-error">{error}</div>}

      {/* ── Service Provider ── */}
      <div className="form-group">
        <label className="form-label" htmlFor="form-service-provider">
          Service Provider
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <div style={{ flexShrink: 0 }}>
            {serviceProvider.trim() ? (
              <ProviderIcon name={serviceProvider} size={34} />
            ) : (
              <div className="provider-icon-placeholder">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              </div>
            )}
          </div>
          <input
            id="form-service-provider"
            type="text"
            className="form-input"
            value={serviceProvider}
            onChange={(e) => setServiceProvider(e.target.value)}
            placeholder="e.g. GitHub, Gmail, Netflix..."
            required
            autoFocus
          />
        </div>
      </div>

      {/* ── Attributes ── */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
          <label className="form-label">
            Attributes
            {rows.length > 0 && (
              <span style={{ fontWeight: 400, marginLeft: "0.4rem", opacity: 0.55 }}>
                ({rows.length})
              </span>
            )}
          </label>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={addRow}
            id="add-attribute-btn"
          >
            + Add Field
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {rows.map((row, idx) => (
            <AttrFieldCard
              key={idx}
              row={row}
              idx={idx}
              onKeyChange={(v) => updateRow(idx, "key", v)}
              onValueChange={(v) => updateRow(idx, "value", v)}
              onRemove={() => removeRow(idx)}
              onGenerate={() => handleGeneratePassword(idx)}
            />
          ))}
        </div>

        {rows.length === 0 && (
          <div className="attr-empty-hint">
            No attributes yet. Click &quot;+ Add Field&quot; to start.
          </div>
        )}

        {/* ── Fixed Status field ── */}
        <div className="attr-field-card status-field-card" style={{ marginTop: "0.5rem" }}>
          <div className="attr-field-key-row">
            <span className="attr-field-key-input" style={{ cursor: "default" }}>
              Status
            </span>
            <span className="attr-default-badge">default field</span>
          </div>
          <div style={{ padding: "0.5rem 0.625rem 0.625rem" }}>
            <StatusDropdown value={status} onChange={setStatus} />
          </div>
        </div>
      </div>

    </form>
  );
}
