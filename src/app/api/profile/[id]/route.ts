import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { reindexSource, deleteSourceChunks } from "@/lib/rag";

export async function PUT(req: NextRequest, ctx: RouteContext<"/api/profile/[id]">) {
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
      `UPDATE profile_sources SET title = ?, category = ?, content = ?, updated_at = datetime('now') WHERE id = ?`
    )
    .run(title.trim(), category || "experience", content.trim(), id);

  if (result.changes === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await reindexSource("profile", id, content.trim());

  const row = await db.prepare(`SELECT * FROM profile_sources WHERE id = ?`).get(id);
  return NextResponse.json(row);
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/profile/[id]">) {
  const { id } = await ctx.params;
  const db = await getDb();
  await db.prepare(`DELETE FROM profile_sources WHERE id = ?`).run(id);
  await deleteSourceChunks("profile", id);
  return NextResponse.json({ ok: true });
}
