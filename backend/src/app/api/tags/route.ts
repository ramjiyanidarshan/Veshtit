import { NextResponse } from "next/server";
import { AccountModel } from "@/lib/model";

/**
 * GET /api/tags
 * Returns all unique tags used across accounts.
 */
export async function GET() {
  try {
    const allTags = await AccountModel.distinct("tags");
    const tags = (allTags as unknown[])
      .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
      .sort();
    return NextResponse.json({ tags });
  } catch (error) {
    console.error("GET /api/tags error:", error);
    return NextResponse.json({ error: "Failed to fetch tags" }, { status: 500 });
  }
}
