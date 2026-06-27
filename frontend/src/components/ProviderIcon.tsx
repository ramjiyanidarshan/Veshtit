"use client";

import { useState } from "react";

interface ProviderIconProps {
  name: string;
  url?: string | null;
  size?: number;
}

export default function ProviderIcon({ name, url, size = 32 }: ProviderIconProps) {
  const [hasError, setHasError] = useState(false);

  // Guess the domain based on the URL attribute, or fallback to name.com
  let domain = "";
  if (url) {
    try {
      // Handle urls that might not have http:// prefix
      const validUrl = url.startsWith("http") ? url : `https://${url}`;
      domain = new URL(validUrl).hostname;
    } catch {
      domain = `${name.toLowerCase().replace(/\s+/g, "")}.com`;
    }
  } else {
    domain = `${name.toLowerCase().replace(/\s+/g, "")}.com`;
  }

  const initial = name.charAt(0).toUpperCase();

  if (hasError) {
    return (
      <div
        className="provider-avatar"
        style={{
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border)",
          fontSize: size * 0.5,
          flexShrink: 0,
        }}
      >
        <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      </div>
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        borderRadius: "8px",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border)",
        flexShrink: 0,
      }}
    >
      <img
        src={`https://www.google.com/s2/favicons?sz=64&domain=${domain}`}
        alt={`${name} icon`}
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
        onError={() => setHasError(true)}
      />
    </div>
  );
}
