import { NextResponse } from "next/server";
import { analyzeOutcomes } from "@/lib/outcomes";
import { sessionOrResponse } from "@/lib/session";
import { withTokenCharge, InsufficientTokensError } from "@/lib/tokens";

export const maxDuration = 300;

export async function POST() {
  const session = await sessionOrResponse();
  if (session instanceof NextResponse) return session;

  try {
    const { report, costUsd } = await withTokenCharge(session.id, session.role, "insights_outcomes", () =>
      analyzeOutcomes(session.id)
    );
    return NextResponse.json({ report, costUsd });
  } catch (err) {
    if (err instanceof InsufficientTokensError) {
      return NextResponse.json({ error: err.message }, { status: 402 });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
