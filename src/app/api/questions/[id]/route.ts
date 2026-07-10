import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function PUT(req: NextRequest, ctx: RouteContext<"/api/questions/[id]">) {
  const { id } = await ctx.params;
  const body = await req.json();
  const { content, question_text, max_length, memo, source_ids, news } = body as {
    content?: string;
    question_text?: string;
    max_length?: number | null;
    memo?: string;
    source_ids?: string[];
    news?: string[];
  };

  const db = await getDb();
  const existing = (await db.prepare(`SELECT * FROM essay_questions WHERE id = ?`).get(id)) as
    | { content: string }
    | undefined;
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (question_text !== undefined) {
    await db.prepare(
      `UPDATE essay_questions SET question_text = ?, max_length = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(question_text.trim(), max_length ?? null, id);
  }

  if (content !== undefined) {
    await db.prepare(
      `UPDATE essay_questions SET content = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(content, id);

    if (content.trim() && content !== existing.content) {
      await db.prepare(
        `INSERT INTO essay_versions (id, question_id, content, source) VALUES (?, ?, ?, 'manual')`
      ).run(randomUUID(), id, content);
    }
  }

  if (source_ids !== undefined) {
    await db.prepare(
      `UPDATE essay_questions SET source_ids = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(JSON.stringify(source_ids), id);
  }

  if (news !== undefined) {
    const newsList = news.map((n) => n.trim()).filter(Boolean).slice(0, 3);
    await db.prepare(`UPDATE essay_questions SET news = ?, updated_at = datetime('now') WHERE id = ?`).run(
      JSON.stringify(newsList),
      id
    );
  }

  if (memo !== undefined) {
    await db.prepare(`UPDATE essay_questions SET memo = ?, updated_at = datetime('now') WHERE id = ?`).run(
      memo,
      id
    );
  }

  const row = await db.prepare(`SELECT * FROM essay_questions WHERE id = ?`).get(id);
  return NextResponse.json(row);
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/questions/[id]">) {
  const { id } = await ctx.params;
  const db = await getDb();
  await db.prepare(`DELETE FROM essay_questions WHERE id = ?`).run(id);
  return NextResponse.json({ ok: true });
}
