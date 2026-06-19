// ─── Account Types ─────────────────────────────────────────────────────────────

export interface Account {
  _id: string;
  serviceProvider: string;
  attributes: Record<string, string | null>;
  passwordHistory?: { password: string; changedAt: string }[];
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

// ─── Veshtit JSON Format ───────────────────────────────────────────────────────

/**
 * The raw JSON format used for import/export.
 * Keys are service provider names, values are arrays of attribute objects.
 */
export type VeshtitJson = {
  [serviceProvider: string]: Record<string, string | null>[];
};
