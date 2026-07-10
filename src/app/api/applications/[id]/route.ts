import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function PUT(req: NextRequest, ctx: RouteContext<"/api/applications/[id]">) {
  const { id } = await ctx.params;
  const body = await req.json();
  const { job_role, status, deadline, notes } = body as {
    job_role?: string;
    status?: string;
    deadline?: string;
    notes?: string;
  };

  if (!job_role?.trim() || !status) {
    return NextResponse.json({ error: "job_role and status are required" }, { status: 400 });
  }

  const db = await getDb();
  const res = await db
    .prepare(
      `UPDATE applications SET job_role = ?, status = ?, deadline = ?, notes = ?, updated_at = datetime('now') WHERE id = ?`
    )
    .run(job_role.trim(), status, deadline || null, notes?.trim() || null, id);

  if (res.changes === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const row = await db
    .prepare(
      `SELECT a.*, c.name AS company_name, c.industry AS industry
       FROM applications a JOIN companies c ON c.id = a.company_id WHERE a.id = ?`
    )
    .get(id);
  return NextResponse.json(row);
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/applications/[id]">) {
  const { id } = await ctx.params;
  const db = await getDb();
  await db.prepare(`DELETE FROM applications WHERE id = ?`).run(id);
  return NextResponse.json({ ok: true });
}
