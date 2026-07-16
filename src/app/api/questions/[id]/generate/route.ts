import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { generateEssayDraft } from "@/lib/generate";
import { checkPlagiarism } from "@/lib/similarity";
import { sessionOrResponse } from "@/lib/session";

export const maxDuration = 300;

export async function POST(_req: NextRequest, ctx: RouteContext<"/api/questions/[id]/generate">) {
  const session = await sessionOrResponse();
  if (session instanceof NextResponse) return session;

  const { id } = await ctx.params;
  const db = await getDb();

  try {
    const { text, costUsd } = await generateEssayDraft(session.id, id);

    await db.prepare(
      `UPDATE essay_questions SET content = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(text, id);

    await db.prepare(
      `INSERT INTO essay_versions (id, question_id, content, source, cost_usd) VALUES (?, ?, ?, 'ai', ?)`
    ).run(randomUUID(), id, text, costUsd);

    const row = await db.prepare(`SELECT * FROM essay_questions WHERE id = ?`).get(id);
    return NextResponse.json({ question: row, costUsd, plagiarism: await checkPlagiarism(text) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
