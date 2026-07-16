import { NextRequest, NextResponse } from "next/server";
import { generateInterviewQuestions } from "@/lib/interview";
import { sessionOrResponse } from "@/lib/session";
import { withTokenCharge, InsufficientTokensError } from "@/lib/tokens";

export const maxDuration = 300;

export async function POST(_req: NextRequest, ctx: RouteContext<"/api/applications/[id]/interview">) {
  const session = await sessionOrResponse();
  if (session instanceof NextResponse) return session;

  const { id } = await ctx.params;

  try {
    const { text, costUsd } = await withTokenCharge(session.id, session.role, "interview_questions", () =>
      generateInterviewQuestions(session.id, id)
    );
    return NextResponse.json({ interview_questions: text, costUsd });
  } catch (err) {
    if (err instanceof InsufficientTokensError) {
      return NextResponse.json({ error: err.message }, { status: 402 });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
