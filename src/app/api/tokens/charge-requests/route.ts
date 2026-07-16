import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sessionOrResponse } from "@/lib/session";
import type { ChargeRequest } from "@/lib/types";

export async function GET() {
  const session = await sessionOrResponse();
  if (session instanceof NextResponse) return session;

  const db = await getDb();
  const rows = (await db
    .prepare(`SELECT * FROM charge_requests WHERE user_id = ? ORDER BY created_at DESC`)
    .all(session.id)) as ChargeRequest[];
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await sessionOrResponse();
  if (session instanceof NextResponse) return session;

  const body = await req.json();
  const { claimed_amount_krw, depositor_name, memo } = body as {
    claimed_amount_krw?: number;
    depositor_name?: string;
    memo?: string;
  };

  if (!claimed_amount_krw || claimed_amount_krw <= 0) {
    return NextResponse.json({ error: "입금 금액을 입력하세요." }, { status: 400 });
  }
  if (!depositor_name?.trim()) {
    return NextResponse.json({ error: "입금자명을 입력하세요." }, { status: 400 });
  }

  const db = await getDb();
  const id = randomUUID();
  await db
    .prepare(
      `INSERT INTO charge_requests (id, user_id, claimed_amount_krw, depositor_name, memo) VALUES (?, ?, ?, ?, ?)`
    )
    .run(id, session.id, Math.round(claimed_amount_krw), depositor_name.trim(), memo?.trim() || null);

  const row = await db.prepare(`SELECT * FROM charge_requests WHERE id = ?`).get(id);
  return NextResponse.json(row, { status: 201 });
}
