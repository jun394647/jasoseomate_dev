import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { reindexSource, deleteSourceChunks } from "@/lib/rag";

export async function PUT(req: NextRequest, ctx: RouteContext<"/api/samples/[id]">) {
  const { id } = await ctx.params;
  const body = await req.json();
  const { company_name, industry, job_role, question, content, result, memo } = body as {
    company_name?: string;
    industry?: string;
    job_role?: string;
    question?: string;
    content?: string;
    result?: string;
    memo?: string;
  };

  if (!question?.trim() || !content?.trim()) {
    return NextResponse.json({ error: "question and content are required" }, { status: 400 });
  }

  const db = await getDb();
  const res = await db
    .prepare(
      `UPDATE sample_essays SET company_name = ?, industry = ?, job_role = ?, question = ?, content = ?, result = ?, memo = ?, updated_at = datetime('now')
       WHERE id = ?`
    )
    .run(
      company_name?.trim() || null,
      industry?.trim() || null,
      job_role?.trim() || null,
      question.trim(),
      content.trim(),
      result || "unknown",
      memo?.trim() || null,
      id
    );

  if (res.changes === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await reindexSource("sample_essay", id, `${question.trim()}\n\n${content.trim()}`);

  const row = await db.prepare(`SELECT * FROM sample_essays WHERE id = ?`).get(id);
  return NextResponse.json(row);
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/samples/[id]">) {
  const { id } = await ctx.params;
  const db = await getDb();
  await db.prepare(`DELETE FROM sample_essays WHERE id = ?`).run(id);
  await deleteSourceChunks("sample_essay", id);
  return NextResponse.json({ ok: true });
}
