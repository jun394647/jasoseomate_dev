import { NextResponse } from "next/server";
import { analyzeOutcomes } from "@/lib/outcomes";

export const maxDuration = 300;

export async function POST() {
  try {
    const { report, costUsd } = await analyzeOutcomes();
    return NextResponse.json({ report, costUsd });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
