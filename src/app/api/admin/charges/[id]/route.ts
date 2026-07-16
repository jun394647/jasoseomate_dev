import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { adminSessionOrResponse } from "@/lib/session";

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/admin/charges/[id]">) {
  const session = await adminSessionOrResponse();
  if (session instanceof NextResponse) return session;

  const { id } = await ctx.params;
  const body = await req.json();
  const { action, granted_tokens, admin_note } = body as {
    action?: "approve" | "reject";
    granted_tokens?: number;
    admin_note?: string;
  };

  const db = await getDb();
  const request = (await db.prepare(`SELECT * FROM charge_requests WHERE id = ?`).get(id)) as
    | { id: string; user_id: string; status: string }
    | undefined;
  if (!request) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (request.status !== "pending") {
    return NextResponse.json({ error: "이미 처리된 요청입니다." }, { status: 400 });
  }

  if (action === "approve") {
    if (!granted_tokens || granted_tokens <= 0) {
      return NextResponse.json({ error: "지급할 토큰 수를 입력하세요." }, { status: 400 });
    }
    const tokens = Math.round(granted_tokens);
    await db
      .prepare(
        `UPDATE charge_requests SET status='approved', granted_tokens=?, admin_note=?, reviewed_by=?, reviewed_at=datetime('now') WHERE id=?`
      )
      .run(tokens, admin_note?.trim() || null, session.id, id);
    await db
      .prepare(`UPDATE users SET token_balance = token_balance + ?, updated_at = datetime('now') WHERE id = ?`)
      .run(tokens, request.user_id);
    const row = (await db.prepare(`SELECT token_balance FROM users WHERE id = ?`).get(request.user_id)) as {
      token_balance: number;
    };
    await db
      .prepare(
        `INSERT INTO token_transactions (id, user_id, delta, reason, balance_after) VALUES (?, ?, ?, ?, ?)`
      )
      .run(randomUUID(), request.user_id, tokens, `admin_credit:${id}`, row.token_balance);
    return NextResponse.json({ ok: true });
  }

  if (action === "reject") {
    await db
      .prepare(
        `UPDATE charge_requests SET status='rejected', admin_note=?, reviewed_by=?, reviewed_at=datetime('now') WHERE id=?`
      )
      .run(admin_note?.trim() || null, session.id, id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "알 수 없는 action입니다." }, { status: 400 });
}
