import { NextRequest, NextResponse } from "next/server";
import { reviewEssay } from "@/lib/review";
import { sessionOrResponse } from "@/lib/session";
import { withTokenCharge, InsufficientTokensError } from "@/lib/tokens";

export const maxDuration = 300;

export async function POST(_req: NextRequest, ctx: RouteContext<"/api/questions/[id]/review">) {
  const session = await sessionOrResponse();
  if (session instanceof NextResponse) return session;

  const { id } = await ctx.params;

  try {
    const { feedback, costUsd } = await withTokenCharge(session.id, session.role, "essay_review", () =>
      reviewEssay(session.id, id)
    );
    return NextResponse.json({ feedback, costUsd });
  } catch (err) {
    if (err instanceof InsufficientTokensError) {
      return NextResponse.json({ error: err.message }, { status: 402 });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
