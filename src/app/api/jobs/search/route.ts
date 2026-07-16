import { NextRequest, NextResponse } from "next/server";
import { sessionOrResponse } from "@/lib/session";
import { searchWorkNetJobs } from "@/lib/worknet";
import { scrapeSaraminJobs } from "@/lib/jobScrape";
import { buildJobSearchLinks } from "@/lib/jobLinks";

// 워크넷 채용정보 API는 개인회원 키로는 사용할 수 없어(기업/기관 전용),
// 사람인 검색 결과 페이지 파싱을 기본 출처로 쓰고 워크넷은 되는 경우 함께 보여준다.
export async function GET(req: NextRequest) {
  const session = await sessionOrResponse();
  if (session instanceof NextResponse) return session;

  const keyword = req.nextUrl.searchParams.get("keyword")?.trim() ?? "";

  const [workNetResult, scrapeResult] = await Promise.all([
    searchWorkNetJobs(keyword),
    scrapeSaraminJobs(keyword),
  ]);

  const jobs = [...workNetResult.jobs, ...scrapeResult.jobs];
  const error = jobs.length === 0 ? scrapeResult.error ?? workNetResult.error : undefined;

  return NextResponse.json({
    configured: workNetResult.configured,
    jobs,
    error,
    fallbackLinks: buildJobSearchLinks(keyword || "채용"),
  });
}
