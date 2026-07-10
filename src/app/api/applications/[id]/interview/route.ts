import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { generateInterviewQuestions } from "@/lib/interview";

export const maxDuration = 300;

export async function POST(_req: NextRequest, ctx: RouteContext<"/api/applications/[id]/interview">) {
  const { id } = await ctx.params;
  const db = await getDb();

  const application = await db.prepare(`SELECT id FROM applications WHERE id = ?`).get(id);
  if (!application) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  try {
    const { text, costUsd } = await generateInterviewQuestions(id);
    return NextResponse.json({ interview_questions: text, costUsd });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
