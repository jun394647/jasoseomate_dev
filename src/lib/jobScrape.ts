// 워크넷 채용정보 API가 개인회원에게 막혀 있어 대안으로 사람인 검색 결과 페이지를
// 직접 파싱한다. 공식 API가 아니라 페이지 구조 변경에 취약할 수 있으므로,
// 파싱 실패 시 절대 throw하지 않고 빈 배열로 우아하게 저하한다.
import type { JobPosting } from "./worknet";

const SEARCH_URL = "https://www.saramin.co.kr/zf_user/search";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export async function scrapeSaraminJobs(
  keyword: string
): Promise<{ jobs: JobPosting[]; error?: string }> {
  try {
    const params = new URLSearchParams({ searchword: keyword.trim() || "채용" });
    const res = await fetch(`${SEARCH_URL}?${params.toString()}`, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      return { jobs: [], error: `사람인 페이지 요청 실패 (${res.status})` };
    }
    return { jobs: parseSaraminHtml(await res.text()) };
  } catch (err) {
    return { jobs: [], error: (err as Error).message };
  }
}

function decodeHtmlEntities(raw: string): string {
  return raw
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function stripTags(raw: string): string {
  return decodeHtmlEntities(raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
}

// 사람인 검색 결과는 <li class="item_recruit">로 각 공고가 구분된다.
// 닫는 태그를 정확히 매칭하기보다, 다음 item_recruit 등장 전까지를 한 블록으로 본다.
function parseSaraminHtml(html: string): JobPosting[] {
  try {
    const chunks = html.split('class="item_recruit"').slice(1, 41);
    const jobs: JobPosting[] = [];

    for (const chunk of chunks) {
      const idMatch = chunk.match(/rec_idx=(\d+)/);
      const titleMatch = chunk.match(/class="job_tit">\s*<a[^>]*title="([^"]+)"/);
      const corpMatch = chunk.match(/class="corp_name">\s*<a[^>]*>([\s\S]*?)<\/a>/);
      if (!idMatch || !titleMatch || !corpMatch) continue;

      const conditionMatch = chunk.match(/class="job_condition">([\s\S]*?)<\/div>/);
      let region: string | undefined;
      let career: string | undefined;
      let employmentType: string | undefined;
      if (conditionMatch) {
        const spans = [...conditionMatch[1].matchAll(/<span>([\s\S]*?)<\/span>/g)].map((m) =>
          stripTags(m[1])
        );
        [region, career, , employmentType] = spans;
      }

      jobs.push({
        id: idMatch[1],
        title: decodeHtmlEntities(titleMatch[1]),
        companyName: stripTags(corpMatch[1]),
        region,
        career,
        employmentType,
        url: `https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=${idMatch[1]}`,
        source: "saramin",
      });
    }
    return jobs;
  } catch {
    return [];
  }
}
