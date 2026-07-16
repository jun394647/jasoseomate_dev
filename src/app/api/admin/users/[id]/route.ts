import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { adminSessionOrResponse } from "@/lib/session";

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/admin/users/[id]">) {
  const session = await adminSessionOrResponse();
  if (session instanceof NextResponse) return session;

  const { id } = await ctx.params;
  const body = await req.json();
  const { action, delta, role } = body as {
    action?: "adjust_tokens" | "set_role";
    delta?: number;
    role?: "admin" | "member";
  };

  const db = await getDb();

  if (action === "adjust_tokens") {
    if (!delta || !Number.isFinite(delta)) {
      return NextResponse.json({ error: "delta가 필요합니다." }, { status: 400 });
    }
    await db
      .prepare(`UPDATE users SET token_balance = token_balance + ?, updated_at = datetime('now') WHERE id = ?`)
      .run(Math.round(delta), id);
    const row = (await db.prepare(`SELECT token_balance FROM users WHERE id = ?`).get(id)) as {
      token_balance: number;
    };
    await db
      .prepare(
        `INSERT INTO token_transactions (id, user_id, delta, reason, balance_after) VALUES (?, ?, ?, 'admin_adjustment', ?)`
      )
      .run(randomUUID(), id, Math.round(delta), row.token_balance);
    return NextResponse.json({ ok: true, token_balance: row.token_balance });
  }

  if (action === "set_role") {
    if (role !== "admin" && role !== "member") {
      return NextResponse.json({ error: "role은 admin 또는 member여야 합니다." }, { status: 400 });
    }
    if (role === "member") {
      const { c } = (await db
        .prepare(`SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND id != ?`)
        .get(id)) as { c: number };
      if (c === 0) {
        return NextResponse.json({ error: "마지막 관리자는 강등할 수 없습니다." }, { status: 400 });
      }
    }
    await db.prepare(`UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?`).run(role, id);
    return NextResponse.json({ ok: true, role });
  }

  return NextResponse.json({ error: "알 수 없는 action입니다." }, { status: 400 });
}
