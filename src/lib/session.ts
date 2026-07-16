import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { UserRole } from "@/lib/types";

export interface AppSession {
  id: string;
  email: string;
  role: UserRole;
}

export async function getSession(): Promise<AppSession | null> {
  const session = await auth();
  const user = session?.user;
  if (!user) return null;
  const extended = user as typeof user & { id?: string; role?: UserRole };
  if (!extended.id || !extended.email) return null;
  return { id: extended.id, email: extended.email, role: extended.role ?? "member" };
}

export class UnauthorizedError extends Error {}
export class ForbiddenError extends Error {}

export async function requireApiSession(): Promise<AppSession> {
  const session = await getSession();
  if (!session) throw new UnauthorizedError("로그인이 필요합니다.");
  return session;
}

export async function requireAdminSession(): Promise<AppSession> {
  const session = await requireApiSession();
  if (session.role !== "admin") throw new ForbiddenError("관리자만 접근할 수 있습니다.");
  return session;
}

// API 라우트에서 try/catch 없이 한 줄로 쓰기 위한 헬퍼.
// 세션 없으면 NextResponse를, 있으면 세션을 반환한다.
export async function sessionOrResponse(): Promise<AppSession | NextResponse> {
  try {
    return await requireApiSession();
  } catch {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
}

export async function adminSessionOrResponse(): Promise<AppSession | NextResponse> {
  try {
    return await requireAdminSession();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "관리자만 접근할 수 있습니다." }, { status: 403 });
    }
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
}
