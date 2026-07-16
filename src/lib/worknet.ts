// 워크넷(고용24) 채용정보 Open API 연동.
// WORKNET_API_KEY 미설정 시 즉시 configured:false로 응답하고, 응답 형식이 예상과
// 다르거나 API 호출이 실패해도 절대 throw하지 않는다 — 실패하면 결과 없이 우아하게 저하.

export interface JobPosting {
  id: string;
  title: string;
  companyName: string;
  region?: string;
  salary?: string;
  career?: string;
  employmentType?: string;
  deadline?: string;
  url: string;
  source: "worknet" | "saramin";
}

const ENDPOINT = "https://www.work24.go.kr/cm/openApi/call/wk/callOpenApiSvcInfo210L01.do";

export async function searchWorkNetJobs(
  keyword: string
): Promise<{ configured: boolean; jobs: JobPosting[]; error?: string }> {
  const apiKey = process.env.WORKNET_API_KEY;
  if (!apiKey) return { configured: false, jobs: [] };

  try {
    const params = new URLSearchParams({
      authKey: apiKey,
      callTp: "L",
      returnType: "XML",
      startPage: "1",
      display: "20",
    });
    if (keyword.trim()) params.set("keyword", keyword.trim());

    const res = await fetch(`${ENDPOINT}?${params.toString()}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return { configured: true, jobs: [], error: `워크넷 API 오류 (${res.status})` };
    }
    const xml = await res.text();
    const apiError = extractTag(xml, "error");
    if (apiError) {
      return { configured: true, jobs: [], error: apiError };
    }
    return { configured: true, jobs: parseWantedXml(xml) };
  } catch (err) {
    return { configured: true, jobs: [], error: (err as Error).message };
  }
}

function decodeXmlEntities(raw: string): string {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

function extractTag(block: string, tag: string): string | undefined {
  const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  const value = m ? decodeXmlEntities(m[1]) : undefined;
  return value || undefined;
}

// 워크넷 응답 스키마가 문서와 다르거나 파싱 중 예외가 나도 throw하지 않고 빈 배열로 저하한다.
function parseWantedXml(xml: string): JobPosting[] {
  try {
    const blocks = xml.match(/<wanted>[\s\S]*?<\/wanted>/g) ?? [];
    const jobs: JobPosting[] = [];
    for (const block of blocks) {
      const id = extractTag(block, "wantedAuthNo");
      const title = extractTag(block, "title");
      const company = extractTag(block, "company");
      const url = extractTag(block, "wantedInfoUrl");
      if (!id || !title || !company || !url) continue;
      jobs.push({
        id,
        title,
        companyName: company,
        region: extractTag(block, "region"),
        salary: extractTag(block, "sal"),
        career: extractTag(block, "career"),
        deadline: extractTag(block, "closeDt"),
        url,
        source: "worknet",
      });
    }
    return jobs;
  } catch {
    return [];
  }
}
