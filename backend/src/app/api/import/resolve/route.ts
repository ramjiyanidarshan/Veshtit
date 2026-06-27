import { NextRequest, NextResponse } from "next/server";
import { AccountModel } from "@/lib/model";
import { encryptAttributes } from "@/lib/crypto";

type Resolution = "ignore" | "update" | "add_new";

interface ConflictResolution {
  existingId: string;
  resolution: Resolution;
  incoming: {
    serviceProvider: string;
    attributes: Record<string, string | null>;
  };
}

interface ResolveBody {
  toInsert: Array<{
    serviceProvider: string;
    attributes: Record<string, string | null>;
  }>;
  resolutions: ConflictResolution[];
}

/**
 * POST /api/import/resolve
 * Finalizes the import based on the user's conflict resolution decisions.
 */
export async function POST(request: NextRequest) {
  try {
    const body: ResolveBody = await request.json();
    const { toInsert = [], resolutions = [] } = body;

    let inserted = 0;
    let updated = 0;
    let ignored = 0;
    const errors: string[] = [];

    // Insert clean new entries
    for (const entry of toInsert) {
      try {
        await AccountModel.insertOne({
          serviceProvider: entry.serviceProvider,
          attributes: await encryptAttributes(entry.attributes),
          source: "import",
        } as never);
        inserted++;
      } catch (err) {
        errors.push(`Failed to insert ${entry.serviceProvider}: ${err}`);
      }
    }

    // Handle conflict resolutions
    for (const resolution of resolutions) {
      const { existingId, resolution: action, incoming } = resolution;

      try {
        if (action === "ignore") {
          ignored++;
        } else if (action === "update") {
          await AccountModel.updateOne(existingId, {
            attributes: await encryptAttributes(incoming.attributes),
            serviceProvider: incoming.serviceProvider,
          } as never);
          updated++;
        } else if (action === "add_new") {
          await AccountModel.insertOne({
            serviceProvider: incoming.serviceProvider,
            attributes: await encryptAttributes(incoming.attributes),
            source: "import",
          } as never);
          inserted++;
        }
      } catch (err) {
        errors.push(
          `Failed to resolve conflict for ${incoming.serviceProvider}: ${err}`
        );
      }
    }

    const sessionId = request.headers.get("x-session-id");
    if (sessionId) {
      const { appendAuditEntry } = await import("@/lib/session");
      await appendAuditEntry(
        sessionId,
        "account.imported",
        `Imported accounts: ${inserted} inserted, ${updated} updated, ${ignored} ignored`
      );
    }

    return NextResponse.json({
      success: true,
      summary: { inserted, updated, ignored, errors },
    });
  } catch (error) {
    console.error("POST /api/import/resolve error:", error);
    return NextResponse.json(
      { error: "Failed to resolve import" },
      { status: 500 }
    );
  }
}
