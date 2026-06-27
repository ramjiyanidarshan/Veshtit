import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import AppShell from "@/components/AppShell";

export default function AboutPage() {
  let licenseText = "License file not found.";
  try {
    const licensePath = path.join(process.cwd(), "..", "LICENSE");
    licenseText = fs.readFileSync(licensePath, "utf-8");
  } catch (error) {
    console.error("Failed to load license:", error);
  }

  let commitHash = "unknown";
  let commitShort = "unknown";
  try {
    commitHash = execSync("git rev-parse HEAD", { cwd: path.join(process.cwd(), "..") }).toString().trim();
    commitShort = commitHash.slice(0, 7);
  } catch (error) {
    console.error("Failed to read git commit:", error);
  }

  const socialLinks = [
    {
      name: "GitHub",
      url: "https://github.com/ramjiyanidarshan",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
        </svg>
      )
    },
    {
      name: "X (Twitter)",
      url: "https://x.com/ramjiyanidarshan",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4l11.733 16h4.267l-11.733 -16z" />
          <path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772" />
        </svg>
      )
    },
    {
      name: "LinkedIn",
      url: "https://linkedin.com/in/ramjiyanidarshan",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
          <rect x="2" y="9" width="4" height="12"></rect>
          <circle cx="4" cy="4" r="2"></circle>
        </svg>
      )
    },
    {
      name: "Instagram",
      url: "https://instagram.com/ramjiyanidarshan",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
        </svg>
      )
    },
    {
      name: "Telegram",
      url: "https://t.me/ramjiyanidarshan",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
      )
    }
  ];

  return (
    <AppShell>
      <div className="main-panel">
        <div className="main-panel-header">
          <h2 className="main-panel-title">About Veshtit</h2>
        </div>
        <div className="main-panel-body" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
          <div className="about-grid">
            {/* Left Column: Info & Socials */}
            <div className="account-card about-card">
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <div style={{ color: "var(--accent-primary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </div>
                <div>
                  <h3 style={{ fontSize: "1.75rem", fontWeight: 800, margin: 0, color: "var(--text-main)", textAlign: "left" }}>Veshtit<sup>&reg;</sup></h3>
                  <p className="text-muted" style={{ margin: "0.25rem 0 0" }}>Digital Account Manager</p>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--text-main)" }}>Developer Information</h4>
                <p className="text-muted" style={{ marginBottom: "0.5rem" }}>Developed by <strong><a href="https://www.darshanramjiyani.com">Darshan Ramjiyani</a></strong>.</p>
                <p className="text-muted" style={{ lineHeight: 1.5 }}>A highly secure, offline-first AES-256 encrypted local password manager designed to keep your sensitive accounts safe, private, and fully under your control.</p>
                <p className="text-muted" style={{ lineHeight: 1.5, color: "var(--text-muted)", marginTop: "0.5rem" }}>Veshtit is a registered trademark of Darshan Ramjiyani.</p>
              </div>

              <div>
                <h4 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--text-main)" }}>Release</h4>
                <p className="text-muted" style={{ fontSize: "0.85rem" }}>
                  Build Version {" "}
                  <code style={{
                    background: "var(--bg-primary)",
                    padding: "0.5rem 0.5rem",
                    borderRadius: "25px",
                    border: "1px solid var(--border-subtle)",
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.8rem",
                    letterSpacing: "0.03em"
                  }}>
                    {commitShort}
                  </code>
                </p>
              </div>

              <div>
                <h4 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "1rem", color: "var(--text-main)" }}>Connect with me</h4>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                  {socialLinks.map((link) => (
                    <a
                      key={link.name}
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      title={link.name}
                      className="social-link"
                    >
                      {link.icon}
                      {link.name}
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: License */}
            <div className="account-card about-card about-license-card">
              <h4 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "1rem", color: "var(--text-main)", textAlign: "center", flexShrink: 0 }}>License</h4>
              <p className="text-muted" style={{ marginBottom: "1rem", fontSize: "0.9rem", textAlign: "center", flexShrink: 0 }}>
                Veshtit is open-source software licensed as follows:
              </p>
              <pre className="about-license-pre">
                {licenseText}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
