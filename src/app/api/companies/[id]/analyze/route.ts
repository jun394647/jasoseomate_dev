import { NextRequest, NextResponse } from "next/server";
import { generateCompanyReport } from "@/lib/companyReport";
import { sessionOrResponse } from "@/lib/session";

export const maxDuration = 300;

export async function POST(_req: NextRequest, ctx: RouteContext<"/api/companies/[id]/analyze">) {
  const session = await sessionOrResponse();
  if (session instanceof NextResponse) return session;

  const { id } = await ctx.params;

  try {
    const { report, costUsd } = await generateCompanyReport(session.id, id);
    return NextResponse.json({ ai_report: report, costUsd });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
