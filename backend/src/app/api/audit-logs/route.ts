import { NextRequest, NextResponse } from "next/server";
import { AuditLogModel } from "@/lib/model";

/**
 * GET /api/audit-logs
 * Returns the most recent audit log entries (default 100).
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const limitParam = url.searchParams.get("limit");
    const limit = Math.min(500, Math.max(1, parseInt(limitParam ?? "100", 10) || 100));
    const entity = url.searchParams.get("entity");

    const collection = await (AuditLogModel as unknown as {
      getCollection: () => Promise<import("mongodb").Collection>;
    }).getCollection?.();

    // Fallback: use findAll (sorted by createdAt desc via the DB layer)
    // We access the collection directly for sorting by createdAt descending.
    const db = await (await import("@/lib/db")).getDb();
    const filter = entity ? { entity } : {};
    const logs = await db
      .collection("auditLogs")
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    return NextResponse.json({
      logs: logs.map((log) => ({
        ...log,
        _id: log._id?.toString(),
      })),
      total: await db.collection("auditLogs").countDocuments(filter),
    });
  } catch (error) {
    console.error("GET /api/audit-logs error:", error);
    return NextResponse.json({ error: "Failed to fetch audit logs" }, { status: 500 });
  }
}
