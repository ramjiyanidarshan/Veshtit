import { NextRequest, NextResponse } from "next/server";
import { authenticator } from "otplib";
import { UserModel } from "@/lib/model";
import { verifyToken, signToken, buildAuthCookieHeader } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tempToken, code } = body;

    if (!tempToken || !code) {
      return NextResponse.json(
        { error: "Token and code are required" },
        { status: 400 }
      );
    }

    const payload = await verifyToken(tempToken);

    if (!payload || !payload.mfaPending) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    const user = await UserModel.findOne({ username: payload.username } as never);

    if (!user || !user.mfaSecret) {
      return NextResponse.json({ error: "Invalid user or MFA not enabled" }, { status: 400 });
    }

    const isValid = authenticator.check(code, user.mfaSecret);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid authenticator code" }, { status: 401 });
    }

    const token = await signToken({ username: user.username });
    const cookieHeader = buildAuthCookieHeader(token);

    return NextResponse.json(
      { success: true, username: user.username },
      { status: 200, headers: { "Set-Cookie": cookieHeader } }
    );
  } catch (error) {
    console.error("Verify MFA error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
