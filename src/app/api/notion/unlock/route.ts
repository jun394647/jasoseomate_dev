import { NextRequest, NextResponse } from "next/server";
import { isNotionUnlocked, unlockToken, UNLOCK_COOKIE } from "@/lib/notionAuth";

export async function GET(req: NextRequest) {
  return NextResponse.json({ unlocked: isNotionUnlocked(req) });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { password } = body as { password?: string };
  const token = unlockToken();

  if (!token || !password?.trim()) {
    return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 403 });
  }
  const { createHash } = await import("node:crypto");
  const given = createHash("sha256").update(password.trim()).digest("hex");
  if (given !== token) {
    return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 403 });
  }

  const res = NextResponse.json({ unlocked: true });
  res.cookies.set(UNLOCK_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30일
    path: "/",
  });
  return res;
}
