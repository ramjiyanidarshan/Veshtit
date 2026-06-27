// ─── Account Types ─────────────────────────────────────────────────────────────

export interface Account {
  _id: string;
  serviceProvider: string;
  attributes: Record<string, string | null>;
  passwordHistory?: { password: string; changedAt: string }[];
  passwordLastChangedAt?: string;
  isFavorite?: boolean;
  tags?: string[];
  isExpired?: boolean;
  isExpiringSoon?: boolean;
  daysUntilExpiry?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface GroupedAccounts {
  [serviceProvider: string]: Account[];
}

// ─── Import Types ──────────────────────────────────────────────────────────────

export interface ImportEntry {
  serviceProvider: string;
  attributes: Record<string, string | null>;
}

export interface ImportConflict {
  incoming: ImportEntry;
  existing: Account;
}

export interface ImportAnalysis {
  toInsert: ImportEntry[];
  conflicts: ImportConflict[];
  summary: {
    newCount: number;
    conflictCount: number;
  };
}

export type ConflictResolution = "ignore" | "update" | "add_new";

export interface ConflictDecision {
  existingId: string;
  resolution: ConflictResolution;
  incoming: ImportEntry;
}

// ─── API Response Types ────────────────────────────────────────────────────────

export interface ApiError {
  error: string;
}

export interface AccountsResponse {
  accounts: Account[];
  grouped: GroupedAccounts;
}

export interface ProvidersResponse {
  providers: string[];
}

export interface ImportResolveResponse {
  success: boolean;
  summary: {
    inserted: number;
    updated: number;
    ignored: number;
    errors: string[];
  };
}

// ─── Audit Log Types ──────────────────────────────────────────────────────────

export interface AuditLogEntry {
  _id: string;
  action: string;
  entity: "account" | "settings" | "auth" | "import" | "export";
  entityId?: string;
  details: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface AuditLogsResponse {
  logs: AuditLogEntry[];
  total: number;
}

// ─── Tags Types ────────────────────────────────────────────────────────────────

export interface TagsResponse {
  tags: string[];
}

// ─── Veshtit JSON Format ───────────────────────────────────────────────────────

export type VeshtitJson = {
  [serviceProvider: string]: Record<string, string | null>[];
};
