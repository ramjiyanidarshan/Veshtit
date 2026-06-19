import { NextRequest, NextResponse } from "next/server";
import { AccountModel } from "@/lib/model";
import { encryptAttributes, decryptAttributes, encrypt, decrypt } from "@/lib/crypto";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/accounts/[id]
 * Returns a single account with decrypted attributes.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const account = await AccountModel.findById(id);

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Decrypt password history if present
    let decryptedHistory: any = undefined;
    if (account.passwordHistory) {
      decryptedHistory = await Promise.all(
        account.passwordHistory.map(async (h) => ({
          password: await decrypt(h.password),
          changedAt: h.changedAt,
        }))
      );
    }

    return NextResponse.json({
      account: {
        ...account,
        _id: account._id?.toString(),
        attributes: await decryptAttributes(account.attributes),
        passwordHistory: decryptedHistory,
      },
    });
  } catch (error) {
    console.error("GET /api/accounts/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch account" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/accounts/[id]
 * Updates an account (partial update of serviceProvider and/or attributes).
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { serviceProvider, attributes } = body;

    const updateData: Record<string, unknown> = {};

    if (serviceProvider !== undefined) {
      if (typeof serviceProvider !== "string") {
        return NextResponse.json(
          { error: "serviceProvider must be a string" },
          { status: 400 }
        );
      }
      updateData.serviceProvider = serviceProvider;
    }

    if (attributes !== undefined) {
      if (typeof attributes !== "object") {
        return NextResponse.json(
          { error: "attributes must be an object" },
          { status: 400 }
        );
      }

      // Fetch the existing account to detect password changes
      const existing = await AccountModel.findById(id);
      if (!existing) {
        return NextResponse.json({ error: "Account not found" }, { status: 404 });
      }

      const decryptedExisting = await decryptAttributes(existing.attributes);
      const oldPassKey = Object.keys(decryptedExisting).find((k) => k.toLowerCase() === "password");
      const oldPassword = oldPassKey ? decryptedExisting[oldPassKey] : null;

      const newPassKey = Object.keys(attributes).find((k) => k.toLowerCase() === "password");
      const newPassword = newPassKey ? attributes[newPassKey] : null;

      if (oldPassword && newPassword && oldPassword !== newPassword) {
        const encryptedOld = await encrypt(oldPassword);
        const historyEntry = {
          password: encryptedOld,
          changedAt: new Date(),
        };
        updateData.passwordHistory = [
          ...(existing.passwordHistory || []),
          historyEntry,
        ];
      }

      updateData.attributes = await encryptAttributes(attributes);
    }

    const updated = await AccountModel.updateOne(id, updateData as never);

    if (!updated) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Decrypt password history if present
    let decryptedHistory: any = undefined;
    if (updated.passwordHistory) {
      decryptedHistory = await Promise.all(
        updated.passwordHistory.map(async (h) => ({
          password: await decrypt(h.password),
          changedAt: h.changedAt,
        }))
      );
    }

    return NextResponse.json({
      account: {
        ...updated,
        _id: updated._id?.toString(),
        attributes: await decryptAttributes(updated.attributes),
        passwordHistory: decryptedHistory,
      },
    });
  } catch (error) {
    console.error("PUT /api/accounts/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update account" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/accounts/[id]
 * Deletes an account by ID.
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const deleted = await AccountModel.deleteOne(id);

    if (!deleted) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/accounts/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
}
