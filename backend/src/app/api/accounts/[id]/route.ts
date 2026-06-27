import { NextRequest, NextResponse } from "next/server";
import { AccountModel } from "@/lib/model";
import { encryptAttributes, decryptAttributes, encrypt, decrypt } from "@/lib/crypto";
import { appendAuditLog } from "@/lib/auditLog";
import { getSetting, SETTING_KEYS } from "@/lib/settings";

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function getRotationDays(): Promise<number> {
  try {
    const v = await getSetting(SETTING_KEYS.PASSWORD_ROTATION_DAYS, "90");
    return Math.max(1, parseInt(v, 10) || 90);
  } catch {
    return 90;
  }
}

function computeExpiryStatus(
  passwordLastChangedAt: Date | undefined,
  createdAt: Date,
  rotationDays: number
) {
  const base = passwordLastChangedAt ?? createdAt;
  const now = Date.now();
  const daysSince = Math.floor((now - new Date(base).getTime()) / 86_400_000);
  const daysUntilExpiry = rotationDays - daysSince;
  return {
    isExpired: daysUntilExpiry <= 0,
    isExpiringSoon: daysUntilExpiry > 0 && daysUntilExpiry <= 14,
    daysUntilExpiry,
  };
}

/**
 * GET /api/accounts/[id]
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const account = await AccountModel.findById(id);

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    let decryptedHistory: unknown = undefined;
    if (account.passwordHistory) {
      decryptedHistory = await Promise.all(
        account.passwordHistory.map(async (h) => ({
          password: await decrypt(h.password),
          changedAt: h.changedAt,
        }))
      );
    }

    const rotationDays = await getRotationDays();
    const expiry = computeExpiryStatus(
      account.passwordLastChangedAt,
      account.createdAt,
      rotationDays
    );

    return NextResponse.json({
      account: {
        ...account,
        _id: account._id?.toString(),
        attributes: await decryptAttributes(account.attributes),
        passwordHistory: decryptedHistory,
        ...expiry,
      },
    });
  } catch (error) {
    console.error("GET /api/accounts/[id] error:", error);
    return NextResponse.json({ error: "Failed to fetch account" }, { status: 500 });
  }
}

/**
 * PUT /api/accounts/[id]
 * Supports partial updates: serviceProvider, attributes, tags, isFavorite.
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { serviceProvider, attributes, tags, isFavorite } = body;

    const updateData: Record<string, unknown> = {};

    if (serviceProvider !== undefined) {
      if (typeof serviceProvider !== "string") {
        return NextResponse.json({ error: "serviceProvider must be a string" }, { status: 400 });
      }
      updateData.serviceProvider = serviceProvider;
    }

    if (isFavorite !== undefined) {
      updateData.isFavorite = Boolean(isFavorite);
    }

    if (tags !== undefined) {
      updateData.tags = Array.isArray(tags) ? tags.map(String) : [];
    }

    if (attributes !== undefined) {
      if (typeof attributes !== "object") {
        return NextResponse.json({ error: "attributes must be an object" }, { status: 400 });
      }

      const existing = await AccountModel.findById(id);
      if (!existing) {
        return NextResponse.json({ error: "Account not found" }, { status: 404 });
      }

      const decryptedExisting = await decryptAttributes(existing.attributes);
      const oldPassKey = Object.keys(decryptedExisting).find((k) =>
        ["password", "pass", "secret", "pin", "token", "key", "passcode"].some((p) =>
          k.toLowerCase().includes(p)
        )
      );
      const oldPassword = oldPassKey ? decryptedExisting[oldPassKey] : null;

      const newPassKey = Object.keys(attributes).find((k) =>
        ["password", "pass", "secret", "pin", "token", "key", "passcode"].some((p) =>
          k.toLowerCase().includes(p)
        )
      );
      const newPassword = newPassKey ? attributes[newPassKey] : null;

      if (oldPassword && newPassword && oldPassword !== newPassword) {
        const encryptedOld = await encrypt(oldPassword);
        updateData.passwordHistory = [
          ...(existing.passwordHistory || []),
          { password: encryptedOld, changedAt: new Date() },
        ];
        updateData.passwordLastChangedAt = new Date();
      }

      updateData.attributes = await encryptAttributes(attributes);
    }

    const updated = await AccountModel.updateOne(id, updateData as never);

    if (!updated) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    await appendAuditLog({
      action: isFavorite !== undefined && Object.keys(body).length === 1
        ? `account.${isFavorite ? "favorited" : "unfavorited"}`
        : "account.updated",
      entity: "account",
      entityId: id,
      details: `Updated account for ${updated.serviceProvider}`,
      metadata: { serviceProvider: updated.serviceProvider, fieldsChanged: Object.keys(updateData) },
    });

    let decryptedHistory: unknown = undefined;
    if (updated.passwordHistory) {
      decryptedHistory = await Promise.all(
        updated.passwordHistory.map(async (h) => ({
          password: await decrypt(h.password),
          changedAt: h.changedAt,
        }))
      );
    }

    const rotationDays = await getRotationDays();
    const expiry = computeExpiryStatus(
      updated.passwordLastChangedAt,
      updated.createdAt,
      rotationDays
    );

    return NextResponse.json({
      account: {
        ...updated,
        _id: updated._id?.toString(),
        attributes: await decryptAttributes(updated.attributes),
        passwordHistory: decryptedHistory,
        ...expiry,
      },
    });
  } catch (error) {
    console.error("PUT /api/accounts/[id] error:", error);
    return NextResponse.json({ error: "Failed to update account" }, { status: 500 });
  }
}

/**
 * DELETE /api/accounts/[id]
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const account = await AccountModel.findById(id);
    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const deleted = await AccountModel.deleteOne(id);
    if (!deleted) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    await appendAuditLog({
      action: "account.deleted",
      entity: "account",
      entityId: id,
      details: `Deleted account for ${account.serviceProvider}`,
      metadata: { serviceProvider: account.serviceProvider },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/accounts/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}
