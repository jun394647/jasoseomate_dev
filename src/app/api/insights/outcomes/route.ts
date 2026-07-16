import { NextResponse } from "next/server";
import { analyzeOutcomes } from "@/lib/outcomes";
import { sessionOrResponse } from "@/lib/session";

export const maxDuration = 300;

export async function POST() {
  const session = await sessionOrResponse();
  if (session instanceof NextResponse) return session;

  try {
    const { report, costUsd } = await analyzeOutcomes(session.id);
    return NextResponse.json({ report, costUsd });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
