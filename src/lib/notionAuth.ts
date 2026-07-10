// 노션 연동 이스터에그 잠금: NOTION_UNLOCK_PASSWORD를 아는 사람만 노션 기능 사용 가능.
// 잠금 해제 시 비밀번호 해시를 httpOnly 쿠키로 저장한다.
import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const UNLOCK_COOKIE = "notion_unlock";

export function unlockToken(): string | null {
  const pw = process.env.NOTION_UNLOCK_PASSWORD;
  if (!pw?.trim()) return null;
  return createHash("sha256").update(pw.trim()).digest("hex");
}

export function isNotionUnlocked(req: NextRequest): boolean {
  const token = unlockToken();
  if (!token) return false; // 비밀번호 미설정 = 노션 기능 전체 잠금
  return req.cookies.get(UNLOCK_COOKIE)?.value === token;
}

// 잠겨 있으면 403 응답을, 열려 있으면 null을 반환
export function guardNotion(req: NextRequest): NextResponse | null {
  if (isNotionUnlocked(req)) return null;
  return NextResponse.json({ error: "노션 연동은 잠겨 있습니다." }, { status: 403 });
}
