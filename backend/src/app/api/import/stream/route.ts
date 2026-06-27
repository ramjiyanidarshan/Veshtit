import { NextRequest, NextResponse } from "next/server";
import { AccountModel } from "@/lib/model";
import { encryptAttributes } from "@/lib/crypto";

interface ConflictDecision {
  existingId: string;
  resolution: "ignore" | "update" | "add_new";
  incoming: { serviceProvider: string; attributes: Record<string, string | null> };
}

interface ImportStreamBody {
  toInsert: Array<{ serviceProvider: string; attributes: Record<string, string | null> }>;
  resolutions: ConflictDecision[];
}

/**
 * POST /api/import/stream
 * Body: same as /api/import/resolve
 *
 * Returns text/event-stream SSE so the frontend can show live import progress.
 *
 * SSE event shapes:
 *   data: { type: "start",    total: N }
 *   data: { type: "progress", done: N, total: N, action: "insert"|"update"|"ignore"|"error", provider: string }
 *   data: { type: "done",     summary: { inserted, updated, ignored, errors } }
 *   data: { type: "error",    message: string }
 */
export async function POST(req: NextRequest) {
  const body: ImportStreamBody = await req.json().catch(() => ({ toInsert: [], resolutions: [] }));
  const { toInsert = [], resolutions = [] } = body;

  const total = toInsert.length + resolutions.length;

  const encoder = new TextEncoder();
  // eslint-disable-next-line prefer-const
  let ctrl!: ReadableStreamDefaultController<Uint8Array>;

  function send(data: object) {
    try { ctrl.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); } catch { /* closed */ }
  }

  const stream = new ReadableStream<Uint8Array>({
    start(c) { ctrl = c; },
  });

  (async () => {
    let inserted = 0, updated = 0, ignored = 0;
    const errors: string[] = [];
    let done = 0;

    try {
      send({ type: "start", total });

      // Insert clean entries
      for (const entry of toInsert) {
        try {
          await AccountModel.insertOne({
            serviceProvider: entry.serviceProvider,
            attributes: await encryptAttributes(entry.attributes),
            source: "import",
          } as never);
          inserted++;
          send({ type: "progress", done: ++done, total, action: "insert", provider: entry.serviceProvider });
        } catch (err) {
          const msg = `Insert ${entry.serviceProvider}: ${err}`;
          errors.push(msg);
          send({ type: "progress", done: ++done, total, action: "error", provider: entry.serviceProvider });
        }
      }

      // Handle conflict resolutions
      for (const { existingId, resolution: action, incoming } of resolutions) {
        try {
          if (action === "ignore") {
            ignored++;
            send({ type: "progress", done: ++done, total, action: "ignore", provider: incoming.serviceProvider });
          } else if (action === "update") {
            await AccountModel.updateOne(existingId, {
              attributes: await encryptAttributes(incoming.attributes),
              serviceProvider: incoming.serviceProvider,
            } as never);
            updated++;
            send({ type: "progress", done: ++done, total, action: "update", provider: incoming.serviceProvider });
          } else if (action === "add_new") {
            await AccountModel.insertOne({
              serviceProvider: incoming.serviceProvider,
              attributes: await encryptAttributes(incoming.attributes),
              source: "import",
            } as never);
            inserted++;
            send({ type: "progress", done: ++done, total, action: "insert", provider: incoming.serviceProvider });
          }
        } catch (err) {
          const msg = `Conflict ${incoming.serviceProvider}: ${err}`;
          errors.push(msg);
          send({ type: "progress", done: ++done, total, action: "error", provider: incoming.serviceProvider });
        }
      }

      const sessionId = req.headers.get("x-session-id");
      if (sessionId) {
        const { appendAuditEntry } = await import("@/lib/session");
        await appendAuditEntry(
          sessionId,
          "account.imported",
          `Imported accounts: ${inserted} inserted, ${updated} updated, ${ignored} ignored`
        );
      }

      send({ type: "done", summary: { inserted, updated, ignored, errors } });
      ctrl.close();
    } catch (err) {
      send({ type: "error", message: err instanceof Error ? err.message : String(err) });
      ctrl.close();
    }
  })();

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
