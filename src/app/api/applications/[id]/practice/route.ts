import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { evaluateInterviewAnswer } from "@/lib/interviewPractice";
import type { InterviewAnswer } from "@/lib/types";

export const maxDuration = 300;

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/applications/[id]/practice">) {
  const { id } = await ctx.params;
  const db = await getDb();
  const rows = (await db
    .prepare(`SELECT * FROM interview_answers WHERE application_id = ? ORDER BY created_at DESC`)
    .all(id)) as InterviewAnswer[];
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest, ctx: RouteContext<"/api/applications/[id]/practice">) {
  const { id } = await ctx.params;
  const body = await req.json();
  const { question_text, answer } = body as { question_text?: string; answer?: string };

  if (!question_text?.trim() || !answer?.trim()) {
    return NextResponse.json({ error: "question_text와 answer가 필요합니다." }, { status: 400 });
  }
  const db = await getDb();
  const app = await db.prepare(`SELECT id FROM applications WHERE id = ?`).get(id);
  if (!app) return NextResponse.json({ error: "not found" }, { status: 404 });

  try {
    const { record, costUsd } = await evaluateInterviewAnswer(id, question_text.trim(), answer.trim());
    return NextResponse.json({ record, costUsd }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
