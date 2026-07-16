import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sessionOrResponse } from "@/lib/session";

export async function GET() {
  const session = await sessionOrResponse();
  if (session instanceof NextResponse) return session;

  if (session.role === "admin") {
    return NextResponse.json({ unlimited: true, balance: null });
  }

  const db = await getDb();
  const row = (await db
    .prepare(`SELECT token_balance FROM users WHERE id = ?`)
    .get(session.id)) as { token_balance: number } | undefined;

  return NextResponse.json({ unlimited: false, balance: row?.token_balance ?? 0 });
}
