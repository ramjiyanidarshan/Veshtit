"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { accountsApi, tagsApi, exportApi, ApiError } from "@/lib/api";
import type { Account, GroupedAccounts } from "@/lib/types";

import Navbar from "@/components/Navbar";
import AccountDetail from "@/components/AccountDetail";
import AccountForm from "@/components/AccountForm";
import ImportWizard from "@/components/ImportWizard";
import ProviderIcon from "@/components/ProviderIcon";

type ModalMode = "create" | "edit" | null;
type FilterStatus = "all" | "Active" | "Disable" | "Deleted";
type BackendFilter = "weak" | "duplicate" | "old" | "favorites" | "expiring" | null;

interface Toast {
  id: number;
  type: "success" | "error" | "info";
  message: string;
}

let toastCounter = 0;

export default function DashboardPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [grouped, setGrouped] = useState<GroupedAccounts>({});
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Account | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [activeBackendFilter, setActiveBackendFilter] = useState<BackendFilter>(null);
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);

  // Tags
  const [allTags, setAllTags] = useState<string[]>([]);

  // Mobile state
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");

  function addToast(type: Toast["type"], message: string) {
    const id = ++toastCounter;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }

  const filteredGrouped = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q && filterStatus === "all" && !activeTagFilter) return grouped;

    const result: GroupedAccounts = {};
    for (const [provider, accs] of Object.entries(grouped)) {
      let filtered = accs;

      if (filterStatus !== "all") {
        filtered = filtered.filter((acc) => {
          const status = Object.entries(acc.attributes).find(
            ([k]) => k.toLowerCase() === "status"
          )?.[1];
          return status === filterStatus;
        });
      }

      if (activeTagFilter) {
        filtered = filtered.filter(
          (acc) => Array.isArray(acc.tags) && acc.tags.includes(activeTagFilter)
        );
      }

      if (q) {
        const providerMatch = provider.toLowerCase().includes(q);
        if (!providerMatch) {
          filtered = filtered.filter((acc) =>
            Object.values(acc.attributes).some(
              (v) => v && v.toLowerCase().includes(q)
            )
          );
        }
      }

      if (filtered.length > 0) {
        result[provider] = filtered;
      }
    }
    return result;
  }, [grouped, searchQuery, filterStatus, activeTagFilter]);

  const isFiltered = searchQuery.trim() !== "" || filterStatus !== "all" || !!activeTagFilter;
  const filteredProviderCount = Object.keys(filteredGrouped).length;
  const totalProviderCount = Object.keys(grouped).length;

  const loadAccounts = useCallback(async (forcedFilter?: BackendFilter | undefined, forcedTag?: string | null) => {
    try {
      setIsLoading(true);
      let filter: string | undefined = undefined;
      let tag: string | undefined = undefined;

      if (forcedFilter !== undefined) {
        filter = forcedFilter || undefined;
      } else if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const filterParam = params.get("filter");
        if (filterParam === "weak" || filterParam === "duplicate" || filterParam === "old" || filterParam === "favorites" || filterParam === "expiring") {
          filter = filterParam;
        }
      }

      if (forcedTag !== undefined) {
        tag = forcedTag || undefined;
      }

      setActiveBackendFilter((filter as BackendFilter) || null);
      const data = await accountsApi.list(filter, tag);
      setAccounts(data.accounts);
      setGrouped(data.grouped);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push("/login");
      } else {
        addToast("error", "Failed to load accounts");
      }
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const loadTags = useCallback(async () => {
    try {
      const data = await tagsApi.list();
      setAllTags(data.tags);
    } catch { /* ignore */ }
  }, []);

  const handleClearBackendFilter = useCallback(() => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("filter");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
    loadAccounts(null);
  }, [loadAccounts]);

  useEffect(() => {
    loadAccounts();
    loadTags();
  }, [loadAccounts, loadTags]);

  useEffect(() => {
    if (!isLoading && Object.keys(grouped).length > 0 && typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const providerParam = params.get("provider");
      const searchParam = params.get("search");
      const filterParam = params.get("filter");

      if (providerParam && grouped[providerParam]) {
        setSelectedProvider(providerParam);
        setMobileView("detail");
      }
      if (searchParam) {
        setSearchQuery(searchParam);
      }
      if (filterParam) {
        if (filterParam === "Active" || filterParam === "Disable" || filterParam === "Deleted") {
          setFilterStatus(filterParam as FilterStatus);
        }
      }
    }
  }, [isLoading, grouped]);

  function handleProviderSelect(provider: string) {
    setSelectedProvider(provider);
    setMobileView("detail");
  }

  function handleMobileBack() {
    setMobileView("list");
    setSelectedProvider(null);
  }

  async function handleCreate(
    serviceProvider: string,
    attributes: Record<string, string | null>,
    tags?: string[]
  ) {
    setIsSaving(true);
    try {
      await accountsApi.create(serviceProvider, attributes, tags);
      await loadAccounts();
      await loadTags();
      setSelectedProvider(serviceProvider);
      setMobileView("detail");
      setModalMode(null);
      addToast("success", `Account created for ${serviceProvider}`);
    } catch {
      addToast("error", "Failed to create account");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpdate(
    serviceProvider: string,
    attributes: Record<string, string | null>,
    tags?: string[]
  ) {
    if (!editingAccount) return;
    setIsSaving(true);
    try {
      await accountsApi.update(editingAccount._id, { serviceProvider, attributes, tags });
      await loadAccounts();
      await loadTags();
      setSelectedProvider(serviceProvider);
      setModalMode(null);
      setEditingAccount(null);
      addToast("success", "Account updated");
    } catch {
      addToast("error", "Failed to update account");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleFavorite(account: Account) {
    try {
      await accountsApi.toggleFavorite(account._id, !account.isFavorite);
      await loadAccounts(activeBackendFilter);
      addToast("success", account.isFavorite ? "Removed from favorites" : "Added to favorites");
    } catch {
      addToast("error", "Failed to update favorite");
    }
  }

  async function handleDelete(account: Account) {
    try {
      await accountsApi.delete(account._id);
      await loadAccounts();
      setShowDeleteConfirm(null);
      addToast("success", "Account deleted");
    } catch {
      addToast("error", "Failed to delete account");
    }
  }

  async function handleExport() {
    try {
      await exportApi.download();
      addToast("success", "Export downloaded");
    } catch {
      addToast("error", "Export failed");
    }
  }

  const selectedAccounts = selectedProvider ? (grouped[selectedProvider] ?? []) : [];

  // Derive expiry stats for the current view
  const expiringCount = accounts.filter((a) => a.isExpiringSoon || a.isExpired).length;
  const favoriteCount = accounts.filter((a) => a.isFavorite).length;

  const BACKEND_FILTER_LABELS: Record<string, { icon: React.ReactNode; text: string }> = {
    weak: {
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5l-.5-.5"/></svg>,
      text: "Showing only accounts with weak passwords needing update.",
    },
    duplicate: {
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>,
      text: "Showing only accounts with duplicate passwords.",
    },
    old: {
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
      text: "Showing only accounts that require password rotation.",
    },
    favorites: {
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>,
      text: "Showing only favorited accounts.",
    },
    expiring: {
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
      text: "Showing accounts with expiring or expired passwords.",
    },
  };

  return (
    <>
      <div className="app-shell">
        <Navbar
          onImport={() => setShowImport(true)}
          onExport={handleExport}
        />

        <div className="app-body">
          {isLoading ? (
            <div className="empty-state" style={{ flex: 1 }}>
              <svg
                className="spin"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--accent-primary)"
                strokeWidth="2"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              <p style={{ color: "var(--text-muted)" }}>Loading accounts...</p>
            </div>
          ) : (
            <>
              <div className="main-content-wrapper">
                {selectedProvider ? (
                  <AccountDetail
                    accounts={selectedAccounts}
                    providerName={selectedProvider}
                    onEdit={(account) => {
                      setEditingAccount(account);
                      setModalMode("edit");
                    }}
                    onDelete={(account) => setShowDeleteConfirm(account)}
                    onAddNew={() => {
                      setEditingAccount(null);
                      setModalMode("create");
                    }}
                    onBack={handleMobileBack}
                    onToggleFavorite={handleToggleFavorite}
                  />
                ) : Object.keys(grouped).length > 0 ? (
                  <div className="main-panel font-sans">
                    <div className="main-panel-header">
                      <h2 className="main-panel-title">Service Providers</h2>
                      <button
                        id="add-account-card-view-btn"
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          setEditingAccount(null);
                          setModalMode("create");
                        }}
                      >
                        + Add Account
                      </button>
                    </div>

                    {/* ── Quick filters bar (Favorites / Expiring) ── */}
                    {(favoriteCount > 0 || expiringCount > 0) && !activeBackendFilter && (
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", padding: "0 0 0.75rem 0" }}>
                        {favoriteCount > 0 && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8rem", color: "#fbbf24" }}
                            onClick={() => loadAccounts("favorites")}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                            </svg>
                            {favoriteCount} Favorite{favoriteCount !== 1 ? "s" : ""}
                          </button>
                        )}
                        {expiringCount > 0 && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8rem", color: "#f43f5e" }}
                            onClick={() => loadAccounts("expiring")}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                              <line x1="12" y1="9" x2="12" y2="13"/>
                              <line x1="12" y1="17" x2="12.01" y2="17"/>
                            </svg>
                            {expiringCount} Password{expiringCount !== 1 ? "s" : ""} Expiring
                          </button>
                        )}
                      </div>
                    )}

                    {/* ── Search & Filter toolbar ── */}
                    <div className="accounts-toolbar">
                      <div className="accounts-search-wrap">
                        <span className="accounts-search-icon">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                          </svg>
                        </span>
                        <input
                          className="accounts-search-input"
                          type="text"
                          placeholder="Search providers or accounts..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          id="accounts-search"
                          autoComplete="off"
                        />
                        {searchQuery && (
                          <button
                            className="accounts-search-clear"
                            onClick={() => setSearchQuery("")}
                            title="Clear search"
                            type="button"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        )}
                      </div>

                      <div className="filter-group">
                        {(
                          [
                            { value: "all", label: "All" },
                            { value: "Active", label: "Active" },
                            { value: "Disable", label: "Disabled" },
                            { value: "Deleted", label: "Deleted" },
                          ] as { value: FilterStatus; label: string }[]
                        ).map(({ value, label }) => (
                          <button
                            key={value}
                            type="button"
                            className={`filter-chip${filterStatus === value ? ` active${value !== "all" ? ` status-${value.toLowerCase()}` : ""}` : ""}`}
                            onClick={() => setFilterStatus(value)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>

                      {isFiltered && (
                        <span className="accounts-results-count">
                          {filteredProviderCount} of {totalProviderCount}
                        </span>
                      )}
                    </div>

                    {/* ── Tag filter chips ── */}
                    {allTags.length > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", flexWrap: "wrap", paddingBottom: "0.75rem" }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ flexShrink: 0 }}>
                          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                          <line x1="7" y1="7" x2="7.01" y2="7" />
                        </svg>
                        {allTags.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            className={`filter-chip${activeTagFilter === tag ? " active" : ""}`}
                            style={{ fontSize: "0.75rem", padding: "2px 10px" }}
                            onClick={() =>
                              setActiveTagFilter((prev) => (prev === tag ? null : tag))
                            }
                          >
                            {tag}
                          </button>
                        ))}
                        {activeTagFilter && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: "0.72rem", padding: "2px 8px", opacity: 0.7 }}
                            onClick={() => setActiveTagFilter(null)}
                          >
                            Clear tag
                          </button>
                        )}
                      </div>
                    )}

                    <div className="main-panel-body">
                      {activeBackendFilter && (
                        <div style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "0.85rem 1.25rem",
                          background: "var(--accent-warning-dim)",
                          border: "1px solid rgba(251, 191, 36, 0.3)",
                          borderRadius: "var(--radius-lg)",
                          marginBottom: "1.25rem",
                          fontSize: "0.88rem",
                          color: "var(--text-primary)"
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                            <span style={{ fontSize: "1.1rem" }}>
                              {BACKEND_FILTER_LABELS[activeBackendFilter]?.icon}
                            </span>
                            <span>{BACKEND_FILTER_LABELS[activeBackendFilter]?.text}</span>
                          </div>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{
                              color: "var(--accent-warning)",
                              padding: "0.25rem 0.75rem",
                              minHeight: "unset",
                              fontSize: "0.82rem",
                              fontWeight: 600
                            }}
                            onClick={handleClearBackendFilter}
                          >
                            Clear Filter
                          </button>
                        </div>
                      )}

                      {filteredProviderCount === 0 ? (
                        <div className="no-results-state">
                          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--border-strong)" strokeWidth="1.5">
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                          </svg>
                          <p className="no-results-title">No providers match</p>
                          <p className="no-results-desc">
                            Try a different search term or clear the filters.
                          </p>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setSearchQuery("");
                              setFilterStatus("all");
                              setActiveTagFilter(null);
                            }}
                          >
                            Clear filters
                          </button>
                        </div>
                      ) : (
                        <div className="provider-cards-grid">
                          {Object.keys(filteredGrouped).sort((a, b) => {
                            // Favorites-containing providers first if not in a special filter
                            const aHasFav = filteredGrouped[a]?.some((acc) => acc.isFavorite);
                            const bHasFav = filteredGrouped[b]?.some((acc) => acc.isFavorite);
                            if (aHasFav && !bHasFav) return -1;
                            if (!aHasFav && bHasFav) return 1;
                            return a.localeCompare(b);
                          }).map((provider) => {
                            const accountsForProv = filteredGrouped[provider] || [];
                            const totalForProv = grouped[provider]?.length ?? accountsForProv.length;
                            const count = accountsForProv.length;

                            const hasFavorite = accountsForProv.some((a) => a.isFavorite);
                            const hasExpired = accountsForProv.some((a) => a.isExpired);
                            const hasExpiring = !hasExpired && accountsForProv.some((a) => a.isExpiringSoon);

                            let firstUrl = null;
                            for (const acc of accountsForProv) {
                              if (acc.attributes["Url"] || acc.attributes["URL"] || acc.attributes["url"]) {
                                firstUrl = acc.attributes["Url"] || acc.attributes["URL"] || acc.attributes["url"];
                                break;
                              }
                            }

                            // Collect tags for this provider
                            const providerTags = Array.from(
                              new Set(accountsForProv.flatMap((a) => a.tags ?? []))
                            );

                            return (
                              <div
                                key={provider}
                                className="provider-card"
                                onClick={() => handleProviderSelect(provider)}
                                id={`provider-card-${provider.replace(/\s+/g, "-").toLowerCase()}`}
                              >
                                <div className="provider-card-icon-wrapper" style={{ position: "relative" }}>
                                  <ProviderIcon name={provider} url={firstUrl} size={42} />
                                  {hasFavorite && (
                                    <span style={{
                                      position: "absolute", top: -4, right: -4,
                                      color: "#fbbf24", lineHeight: 1,
                                    }}>
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1">
                                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                      </svg>
                                    </span>
                                  )}
                                </div>
                                <h3 className="provider-card-name">{provider}</h3>
                                <p className="provider-card-count">
                                  {isFiltered && count !== totalForProv
                                    ? `${count} of ${totalForProv} accounts`
                                    : `${count} ${count === 1 ? "account" : "accounts"}`}
                                </p>
                                {/* Expiry indicator */}
                                {(hasExpired || hasExpiring) && (
                                  <span style={{
                                    marginTop: "0.25rem",
                                    fontSize: "0.65rem", fontWeight: 700, padding: "1px 6px",
                                    borderRadius: "999px",
                                    background: hasExpired ? "rgba(244,63,94,0.12)" : "rgba(251,191,36,0.12)",
                                    color: hasExpired ? "#f43f5e" : "#fbbf24",
                                    border: `1px solid ${hasExpired ? "rgba(244,63,94,0.3)" : "rgba(251,191,36,0.3)"}`,
                                    letterSpacing: "0.03em",
                                  }}>
                                    {hasExpired ? "Password Expired" : "Expiring Soon"}
                                  </span>
                                )}
                                {/* Tag chips on card */}
                                {providerTags.length > 0 && (
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem", marginTop: "0.375rem", justifyContent: "center" }}>
                                    {providerTags.slice(0, 3).map((tag) => (
                                      <span key={tag} style={{
                                        fontSize: "0.62rem", fontWeight: 600, padding: "1px 6px",
                                        borderRadius: "999px", background: "var(--bg-hover)",
                                        color: "var(--text-muted)", border: "1px solid var(--border-subtle)",
                                      }}>
                                        {tag}
                                      </span>
                                    ))}
                                    {providerTags.length > 3 && (
                                      <span style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>
                                        +{providerTags.length - 3}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div
                    className="main-panel"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <div className="empty-state">
                      <div className="empty-state-icon" style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                      </div>
                      <p className="empty-state-title">Welcome to Veshtit</p>
                      <p className="empty-state-desc">
                        Create your first account to get started.
                      </p>
                      <button
                        id="get-started-btn"
                        className="btn btn-primary"
                        onClick={() => setModalMode("create")}
                      >
                        + Create First Account
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Create / Edit Modal */}
      {modalMode && (
        <div
          className="modal-overlay"
          onClick={(e) =>
            e.target === e.currentTarget && setModalMode(null)
          }
        >
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                {modalMode === "edit" && editingAccount ? (
                  <>
                    <ProviderIcon name={editingAccount.serviceProvider} size={22} />
                    Edit {editingAccount.serviceProvider}
                  </>
                ) : (
                  "New Account"
                )}
              </h2>
              <button
                id="close-form-modal"
                className="btn btn-ghost btn-icon"
                onClick={() => {
                  setModalMode(null);
                  setEditingAccount(null);
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <AccountForm
                initialData={editingAccount}
                initialProvider={selectedProvider ?? ""}
                onSubmit={modalMode === "create" ? handleCreate : handleUpdate}
              />
            </div>
            <div className="modal-footer">
              <button
                id="form-cancel-btn"
                type="button"
                className="btn btn-secondary"
                disabled={isSaving}
                onClick={() => {
                  setModalMode(null);
                  setEditingAccount(null);
                }}
              >
                Cancel
              </button>
              <button
                id="form-submit-btn"
                type="submit"
                form="account-form"
                className="btn btn-primary"
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <svg className="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    Saving...
                  </>
                ) : modalMode === "create" ? (
                  "Create Account"
                ) : (
                  "Update Account"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          className="modal-overlay"
          onClick={(e) =>
            e.target === e.currentTarget && setShowDeleteConfirm(null)
          }
        >
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 className="modal-title">Delete Account</h2>
            </div>
            <div className="modal-body">
              <p style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                Are you sure you want to delete this account for{" "}
                <strong style={{ color: "var(--text-primary)" }}>
                  {showDeleteConfirm.serviceProvider}
                </strong>
                ? This action cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button
                id="cancel-delete-btn"
                className="btn btn-secondary"
                onClick={() => setShowDeleteConfirm(null)}
              >
                Cancel
              </button>
              <button
                id="confirm-delete-btn"
                className="btn btn-danger"
                onClick={() => handleDelete(showDeleteConfirm)}
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Wizard */}
      {showImport && (
        <ImportWizard
          onClose={() => setShowImport(false)}
          onImportComplete={loadAccounts}
        />
      )}

      {/* Toast notifications */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <span>
              {toast.type === "success" && "✓"}
              {toast.type === "error" && "✕"}
              {toast.type === "info" && "ℹ"}
            </span>
            {toast.message}
          </div>
        ))}
      </div>
    </>
  );
}
