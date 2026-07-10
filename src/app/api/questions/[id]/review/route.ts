import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { reviewEssay } from "@/lib/review";

export const maxDuration = 300;

export async function POST(_req: NextRequest, ctx: RouteContext<"/api/questions/[id]/review">) {
  const { id } = await ctx.params;
  const db = await getDb();

  const question = await db.prepare(`SELECT id FROM essay_questions WHERE id = ?`).get(id);
  if (!question) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  try {
    const { feedback, costUsd } = await reviewEssay(id);
    return NextResponse.json({ feedback, costUsd });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
