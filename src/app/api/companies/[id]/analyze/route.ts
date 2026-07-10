import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { generateCompanyReport } from "@/lib/companyReport";

export const maxDuration = 300;

export async function POST(_req: NextRequest, ctx: RouteContext<"/api/companies/[id]/analyze">) {
  const { id } = await ctx.params;
  const db = await getDb();

  const company = await db.prepare(`SELECT id FROM companies WHERE id = ?`).get(id);
  if (!company) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  try {
    const { report, costUsd } = await generateCompanyReport(id);
    return NextResponse.json({ ai_report: report, costUsd });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
