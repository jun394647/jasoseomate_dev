import { NextRequest, NextResponse } from "next/server";
import { sessionOrResponse } from "@/lib/session";
import { searchWorkNetJobs } from "@/lib/worknet";
import { scrapeSaraminJobs } from "@/lib/jobScrape";
import { buildJobSearchLinks } from "@/lib/jobLinks";

// 사람인 검색 결과 페이지(약 2MB)를 원격 함수에서 내려받다 보니 기본 실행 시간보다
// 여유가 필요할 수 있어 넉넉히 잡아둔다.
export const maxDuration = 30;

// 워크넷 채용정보 API는 개인회원 키로는 사용할 수 없어(기업/기관 전용),
// 사람인 검색 결과 페이지 파싱을 기본 출처로 쓰고 워크넷은 되는 경우 함께 보여준다.
export async function GET(req: NextRequest) {
  const session = await sessionOrResponse();
  if (session instanceof NextResponse) return session;

  const keyword = req.nextUrl.searchParams.get("keyword")?.trim() ?? "";
  // scope=major: 검색 없이 처음 페이지에 뜨는 기본 목록 — 주요 대기업/매출1000대기업/
  // 외국계기업으로 좁힌다. 사용자가 직접 검색하면 scope=all로 어떤 기업이든 나오게 한다.
  const majorOnly = req.nextUrl.searchParams.get("scope") !== "all";

  const [workNetResult, scrapeResult] = await Promise.all([
    searchWorkNetJobs(keyword),
    scrapeSaraminJobs(keyword, { majorOnly }),
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
