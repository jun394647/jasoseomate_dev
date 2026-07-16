import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sessionOrResponse } from "@/lib/session";

export async function POST(req: NextRequest, ctx: RouteContext<"/api/applications/[id]/questions">) {
  const session = await sessionOrResponse();
  if (session instanceof NextResponse) return session;

  const { id: applicationId } = await ctx.params;
  const body = await req.json();
  const { question_text, max_length, source_ids, news } = body as {
    question_text?: string;
    max_length?: number;
    source_ids?: string[];
    news?: string[];
  };

  if (!question_text?.trim()) {
    return NextResponse.json({ error: "question_text is required" }, { status: 400 });
  }

  const db = await getDb();
  const application = await db
    .prepare(`SELECT id FROM applications WHERE id = ? AND user_id = ?`)
    .get(applicationId, session.id);
  if (!application) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { maxOrder } = (await db
    .prepare(
      `SELECT COALESCE(MAX(order_index), -1) AS maxOrder FROM essay_questions WHERE application_id = ?`
    )
    .get(applicationId)) as { maxOrder: number };

  const id = randomUUID();
  const newsList = (news ?? []).map((n) => n.trim()).filter(Boolean).slice(0, 3);

  await db.prepare(
    `INSERT INTO essay_questions (id, application_id, question_text, max_length, order_index, source_ids, news) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    applicationId,
    question_text.trim(),
    max_length || null,
    maxOrder + 1,
    JSON.stringify(source_ids ?? []),
    JSON.stringify(newsList)
  );

  const row = await db.prepare(`SELECT * FROM essay_questions WHERE id = ?`).get(id);
  return NextResponse.json(row, { status: 201 });
}
