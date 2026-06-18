"use client";

import { useState, useMemo } from "react";
import type { GroupedAccounts, Account } from "@/lib/types";
import ProviderIcon from "./ProviderIcon";

interface ProviderListProps {
  grouped: GroupedAccounts;
  selectedProvider: string | null;
  onSelect: (provider: string) => void;
  onAddNew: () => void;
  isMobileOpen: boolean;
  onClose: () => void;
}

type SortOption = "a-z" | "z-a" | "most-accounts" | "least-accounts";

export default function ProviderList({
  grouped,
  selectedProvider,
  onSelect,
  onAddNew,
  isMobileOpen,
  onClose,
}: ProviderListProps) {
  const [search, setSearch] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("a-z");

  const filteredProviders = useMemo(() => {
    let providers = Object.keys(grouped);

    // 1. Global Search
    if (search.trim()) {
      const q = search.toLowerCase();
      providers = providers.filter((p) => {
        // Match provider name
        if (p.toLowerCase().includes(q)) return true;
        // Match any account attribute
        const accounts = grouped[p] || [];
        return accounts.some((acc: Account) => {
          // Check attributes (excluding sensitive fields which would be encrypted/unmatchable anyway)
          return Object.values(acc.attributes).some(
            (val) => val && String(val).toLowerCase().includes(q)
          );
        });
      });
    }

    // 2. Sort
    providers.sort((a, b) => {
      const countA = grouped[a].length;
      const countB = grouped[b].length;
      
      switch (sortOption) {
        case "a-z":
          return a.localeCompare(b, undefined, { sensitivity: "base" });
        case "z-a":
          return b.localeCompare(a, undefined, { sensitivity: "base" });
        case "most-accounts":
          return countB - countA || a.localeCompare(b);
        case "least-accounts":
          return countA - countB || a.localeCompare(b);
        default:
          return 0;
      }
    });

    return providers;
  }, [grouped, search, sortOption]);

  function getFirstUrl(provider: string) {
    const accounts = grouped[provider] || [];
    for (const acc of accounts) {
      if (acc.attributes["Url"] || acc.attributes["URL"] || acc.attributes["url"]) {
        return acc.attributes["Url"] || acc.attributes["URL"] || acc.attributes["url"];
      }
    }
    return null;
  }

  function getAccountCount(provider: string) {
    return grouped[provider]?.length ?? 0;
  }

  function handleSelect(provider: string) {
    onSelect(provider);
    onClose(); // auto-close drawer on mobile after selection
  }

  return (
    <>
      {/* Dim overlay — mobile only, shown when drawer is open */}
      {isMobileOpen && (
        <div
          className="sidebar-overlay"
          onClick={onClose}
          aria-label="Close menu"
        />
      )}

      <div className={`sidebar${isMobileOpen ? " mobile-open" : ""}`}>
        <div className="sidebar-header">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span className="sidebar-title">
              Providers ({filteredProviders.length})
            </span>
            <button
              id="add-provider-btn"
              className="btn btn-primary btn-sm"
              onClick={onAddNew}
              title="Add new account"
            >
              + New
            </button>
          </div>

          <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
            <div className="search-wrapper" style={{ flex: 1 }}>
              <span className="search-icon">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input
                id="provider-search"
                type="search"
                className="form-input search-input"
                placeholder="Global search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select 
              className="form-input" 
              style={{ width: "auto", padding: "6px" }}
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              title="Sort Providers"
            >
              <option value="a-z">A-Z</option>
              <option value="z-a">Z-A</option>
              <option value="most-accounts">Most</option>
              <option value="least-accounts">Least</option>
            </select>
          </div>
        </div>

        <div className="sidebar-list">
          {filteredProviders.length === 0 ? (
            <div className="empty-state" style={{ padding: "2rem 1rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.8rem" }}>
              {search ? "No providers match your search" : "No providers yet"}
            </div>
          ) : (
            filteredProviders.map((p) => {
              const count = getAccountCount(p);
              return (
                <div
                  key={p}
                  id={`provider-${p.replace(/\s+/g, "-").toLowerCase()}`}
                  className={`sidebar-item ${
                    selectedProvider === p ? "active" : ""
                  }`}
                  onClick={() => handleSelect(p)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && handleSelect(p)}
                >
                  <div className="sidebar-item-icon" style={{ background: "transparent", border: "none" }}>
                    <ProviderIcon name={p} url={getFirstUrl(p)} size={28} />
                  </div>
                  <span className="sidebar-item-name">{p}</span>
                  <span className="sidebar-item-count">{count}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
