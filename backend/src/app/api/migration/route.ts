import { NextResponse } from "next/server";
import { AccountModel } from "@/lib/model";
import { encryptAttributes, decryptAttributes } from "@/lib/crypto";

/**
 * POST /api/migration
 * One-time migration endpoint to decrypt existing non-sensitive fields
 * back into plaintext to optimize searchability.
 */
export async function POST() {
  try {
    const accounts = await AccountModel.findAll();
    let migratedCount = 0;

    for (const account of accounts) {
      // 1. Decrypt all existing attributes to get the raw data
      const plaintextAttributes = await decryptAttributes(account.attributes);

      // 2. Re-encrypt using the new selective logic 
      // (non-sensitive fields will remain plaintext)
      const newAttributes = await encryptAttributes(plaintextAttributes);

      // 3. Update the database record directly
      // Since Model doesn't have an update method natively exposed without ID,
      // we can use findOneAndUpdate or similar if available, or just use the raw collection.
      const collection = await (AccountModel as any).getCollection();
      await collection.updateOne(
        { _id: account._id },
        { $set: { attributes: newAttributes, updatedAt: new Date() } }
      );

      migratedCount++;
    }

    return NextResponse.json({
      success: true,
      message: `Successfully migrated ${migratedCount} accounts. Non-sensitive fields are now in plaintext.`,
    });
  } catch (error: any) {
    console.error("Migration error:", error);
    return NextResponse.json(
      { error: "Migration failed", details: error.message },
      { status: 500 }
    );
  }
}
