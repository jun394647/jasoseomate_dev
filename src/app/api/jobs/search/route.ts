import { NextRequest, NextResponse } from "next/server";
import { sessionOrResponse } from "@/lib/session";
import { searchWorkNetJobs } from "@/lib/worknet";
import { buildJobSearchLinks } from "@/lib/jobLinks";

export async function GET(req: NextRequest) {
  const session = await sessionOrResponse();
  if (session instanceof NextResponse) return session;

  const keyword = req.nextUrl.searchParams.get("keyword")?.trim() ?? "";
  const { configured, jobs, error } = await searchWorkNetJobs(keyword);

  return NextResponse.json({
    configured,
    jobs,
    error,
    fallbackLinks: buildJobSearchLinks(keyword || "채용"),
  });
}
