import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { UserModel } from "@/lib/model";
import { signToken, signTempToken, buildAuthCookieHeader } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    const user = await UserModel.findOne({ username } as never);

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    if (user.mfaEnabled) {
      const tempToken = await signTempToken({ username: user.username, mfaPending: true });
      return NextResponse.json(
        { success: true, mfaRequired: true, tempToken },
        { status: 200 }
      );
    }

    const token = await signToken({ username: user.username });
    const cookieHeader = buildAuthCookieHeader(token);

    return NextResponse.json(
      { success: true, username: user.username },
      { status: 200, headers: { "Set-Cookie": cookieHeader } }
    );
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
