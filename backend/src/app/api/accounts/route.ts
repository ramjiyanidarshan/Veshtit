import { NextRequest, NextResponse } from "next/server";
import { AccountModel } from "@/lib/model";
import { encryptAttributes, decryptAttributes, decrypt } from "@/lib/crypto";

/**
 * GET /api/accounts
 * Returns all accounts with decrypted attributes.
 */
export async function GET() {
  try {
    const accounts = await AccountModel.findAll();

    const decrypted = await Promise.all(
      accounts.map(async (account) => {
        let decryptedHistory: any = undefined;
        if (account.passwordHistory) {
          decryptedHistory = await Promise.all(
            account.passwordHistory.map(async (h) => ({
              password: await decrypt(h.password),
              changedAt: h.changedAt,
            }))
          );
        }

        return {
          ...account,
          _id: account._id?.toString(),
          attributes: await decryptAttributes(account.attributes),
          passwordHistory: decryptedHistory,
        };
      })
    );

    // Group by serviceProvider
    const grouped: Record<string, typeof decrypted> = {};
    for (const account of decrypted) {
      if (!grouped[account.serviceProvider]) {
        grouped[account.serviceProvider] = [];
      }
      grouped[account.serviceProvider].push(account);
    }

    return NextResponse.json({ accounts: decrypted, grouped });
  } catch (error) {
    console.error("GET /api/accounts error:", error);
    return NextResponse.json(
      { error: "Failed to fetch accounts" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/accounts
 * Creates a new account entry with encrypted attributes.
 *
 * Body: { serviceProvider: string, attributes: Record<string, string | null> }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { serviceProvider, attributes } = body;

    if (!serviceProvider || typeof serviceProvider !== "string") {
      return NextResponse.json(
        { error: "serviceProvider is required and must be a string" },
        { status: 400 }
      );
    }

    if (!attributes || typeof attributes !== "object") {
      return NextResponse.json(
        { error: "attributes must be an object" },
        { status: 400 }
      );
    }

    const encryptedAttributes = await encryptAttributes(attributes);

    const newAccount = await AccountModel.insertOne({
      serviceProvider,
      attributes: encryptedAttributes,
      source: "manual",
    });

    return NextResponse.json(
      {
        account: {
          ...newAccount,
          _id: newAccount._id?.toString(),
          attributes: await decryptAttributes(newAccount.attributes),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/accounts error:", error);
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
  }
}
