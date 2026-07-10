import { getDb } from "./db";
import { runClaude } from "./claude";
import { reindexSource } from "./rag";
import { parseJsonStringArray } from "./types";
import type { Company, CompanyArchive } from "./types";

const SYSTEM_PROMPT = `당신은 한국 채용시장과 산업 분석에 정통한 취업 컨설턴트입니다.
지원자가 모아 둔 기업 정보(기업 분석 메모, 인재상, 주요 뉴스, 아카이브한 기사·자료)를 종합해
자기소개서 작성에 바로 쓸 수 있는 구조화된 기업 분석 리포트를 만듭니다.

원칙:
- 제공된 자료에 있는 사실만 사용한다. 자료에 없는 수치나 사건을 지어내지 않는다.
- 자료가 부족한 항목은 "(자료 부족)"이라고 명시하고 넘어간다.
- 자소서 활용 포인트는 "이 기업의 어떤 점과 지원자의 어떤 준비를 연결하면 좋은지" 실전 관점으로 쓴다.

출력 형식 (반드시 이 4개 섹션 제목 그대로, 마크다운·이모지 없이):
[사업 현황]
(주력 사업, 시장 위치를 3~5문장)

[최근 이슈]
(뉴스·아카이브에서 뽑은 핵심 이슈를 항목당 한 줄, 3~5개)

[인재상 해석]
(인재상 문구를 실제 평가 포인트로 풀어 2~4문장)

[자소서 활용 포인트]
(문항 작성 시 연결할 소재·키워드 제안, 항목당 한 줄, 3~5개)`;

export async function generateCompanyReport(companyId: string): Promise<{
  report: string;
  costUsd: number | null;
}> {
  const db = await getDb();
  const company = (await db.prepare(`SELECT * FROM companies WHERE id = ?`).get(companyId)) as
    | Company
    | undefined;
  if (!company) throw new Error("기업을 찾을 수 없습니다.");

  const archives = (await db
    .prepare(`SELECT * FROM company_archives WHERE company_id = ? ORDER BY created_at DESC`)
    .all(companyId)) as CompanyArchive[];

  const newsList = parseJsonStringArray(company.news ?? "[]");

  const hasMaterial =
    Boolean(company.analysis?.trim() || company.talent_profile?.trim()) ||
    newsList.length > 0 ||
    archives.length > 0;
  if (!hasMaterial) {
    throw new Error("분석할 자료가 없습니다. 기업 정보, 뉴스, 아카이브를 먼저 등록하세요.");
  }

  const archiveSection =
    archives.length > 0
      ? `\n[아카이브한 기사/자료]\n${archives
          .map((a, i) => `${i + 1}. ${a.title}\n${a.content}`)
          .join("\n\n")}\n`
      : "";

  const userPrompt = `[기업]
- 이름: ${company.name}${company.industry ? ` (${company.industry})` : ""}
- 기업 분석 메모: ${company.analysis ?? "(없음)"}
- 인재상: ${company.talent_profile ?? "(없음)"}

[주요 뉴스]
${newsList.length > 0 ? newsList.map((n, i) => `${i + 1}. ${n}`).join("\n") : "(없음)"}
${archiveSection}
[요청]
위 자료를 종합해 기업 분석 리포트를 작성해줘. 지정된 출력 형식만 사용해.`;

  const result = await runClaude(userPrompt, SYSTEM_PROMPT);
  const report = result.text.trim();

  await db.prepare(`UPDATE companies SET ai_report = ?, updated_at = datetime('now') WHERE id = ?`).run(
    report,
    companyId
  );

  // 리포트도 RAG 재료로 인덱싱: 기존 company 텍스트(분석+인재상+뉴스)에 합쳐 재인덱싱
  const ragText = [company.analysis, company.talent_profile, ...newsList, report]
    .filter(Boolean)
    .join("\n\n");
  await reindexSource("company", companyId, ragText);

  return { report, costUsd: result.costUsd };
}
