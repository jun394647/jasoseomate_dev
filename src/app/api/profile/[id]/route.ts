import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { reindexSource, deleteSourceChunks } from "@/lib/rag";
import { sessionOrResponse } from "@/lib/session";

export async function PUT(req: NextRequest, ctx: RouteContext<"/api/profile/[id]">) {
  const session = await sessionOrResponse();
  if (session instanceof NextResponse) return session;

  const { id } = await ctx.params;
  const body = await req.json();
  const { title, category, content } = body as {
    title?: string;
    category?: string;
    content?: string;
  };

  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json({ error: "title and content are required" }, { status: 400 });
  }

  const db = await getDb();
  const result = await db
    .prepare(
      `UPDATE profile_sources SET title = ?, category = ?, content = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?`
    )
    .run(title.trim(), category || "experience", content.trim(), id, session.id);

  if (result.changes === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await reindexSource(session.id, "profile", id, content.trim());

  const row = await db.prepare(`SELECT * FROM profile_sources WHERE id = ?`).get(id);
  return NextResponse.json(row);
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/profile/[id]">) {
  const session = await sessionOrResponse();
  if (session instanceof NextResponse) return session;

  const { id } = await ctx.params;
  const db = await getDb();
  await db
    .prepare(`DELETE FROM profile_sources WHERE id = ? AND user_id = ?`)
    .run(id, session.id);
  await deleteSourceChunks("profile", id);
  return NextResponse.json({ ok: true });
}
