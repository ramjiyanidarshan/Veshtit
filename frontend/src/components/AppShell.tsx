"use client";

import Navbar from "./Navbar";

interface AppShellProps {
  children: React.ReactNode;
  onImport?: () => void;
  onExport?: () => void;
}

export default function AppShell({ children, onImport, onExport }: AppShellProps) {
  return (
    <div className="app-shell">
      <div className="app-bg-orb app-bg-orb-1" />
      <div className="app-bg-orb app-bg-orb-2" />
      <div className="app-bg-orb app-bg-orb-3" />
      <Navbar onImport={onImport} onExport={onExport} />
      <div className="app-page-body">
        {children}
      </div>
    </div>
  );
}
