import { AuditLogModel } from "./model";

interface AuditLogEntry {
  action: string;
  entity: "account" | "settings" | "auth" | "import" | "export";
  entityId?: string;
  details: string;
  metadata?: Record<string, unknown>;
}

export async function appendAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await AuditLogModel.insertOne({
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      details: entry.details,
      metadata: entry.metadata ?? {},
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}
