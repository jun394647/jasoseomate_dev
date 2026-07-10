import { getDb } from "./db";
import { searchChunks } from "./rag";
import { runClaude } from "./claude";
import { parseJsonStringArray } from "./types";
import type { Application, Company, EssayQuestion, ProfileSource } from "./types";
import { PROFILE_CATEGORY_LABELS } from "./types";

const SYSTEM_PROMPT = `당신은 한국 채용시장에 정통한 자기소개서(자소서) 작성 전문 컨설턴트입니다.
지원자가 제공한 경험/경력 정보와 과거 우수(합격) 자소서 예시, 기업 분석 자료를 참고하여
해당 기업의 인재상과 지원 직무에 맞춘 자기소개서 답안을 작성합니다.

원칙:
- 제공된 지원자 정보에 없는 경력, 사실, 수치를 지어내지 않는다. 정보가 부족하면 있는 정보 안에서 최대한 설득력 있게 구성한다.
- 우수 자소서 예시는 문체/구성/논리 전개 참고용이며 문장을 그대로 베끼지 않는다.
- 두괄식으로 핵심 메시지를 먼저 제시하고, STAR(상황-과제-행동-결과) 구조로 구체적 경험을 풀어낸다.
- 기업의 인재상, 산업 특성, 직무 요구사항과의 연결고리를 자연스럽게 녹인다.
- 글자수 제한이 주어지면 반드시 그 범위 내로 작성한다.

출력 형식 (반드시 지킬 것):
- 오직 자기소개서 답안 본문 텍스트만 출력한다.
- 제목, 헤딩(#), 굵게(**) 등 마크다운 서식, 이모지, 따옴표를 절대 사용하지 않는다.
- "글자 수", "작성 포인트", "필요하시면 ~해드릴 수 있습니다" 같은 메타 설명·안내 문구·후속 제안을 절대 덧붙이지 않는다.
- 답안 본문 앞뒤에 어떤 부연 설명도 없이, 첫 글자부터 마지막 글자까지 순수 자소서 본문만 작성한다.`;

function buildRetrievalQuery(company: Company, application: Application, question: EssayQuestion) {
  return [company.name, company.industry, application.job_role, question.question_text]
    .filter(Boolean)
    .join(" ");
}

function formatChunkList(label: string, chunks: { content: string; meta?: string }[]) {
  if (chunks.length === 0) return "";
  const body = chunks
    .map((c, i) => `${i + 1}. ${c.meta ? `(${c.meta}) ` : ""}${c.content}`)
    .join("\n");
  return `\n[${label}]\n${body}\n`;
}

export async function generateEssayDraft(
  questionId: string,
  conceptHint?: string
): Promise<{
  text: string;
  costUsd: number | null;
}> {
  const db = await getDb();
  const question = (await db
    .prepare(`SELECT * FROM essay_questions WHERE id = ?`)
    .get(questionId)) as EssayQuestion | undefined;
  if (!question) throw new Error("문항을 찾을 수 없습니다.");

  const application = (await db
    .prepare(`SELECT * FROM applications WHERE id = ?`)
    .get(question.application_id)) as Application | undefined;
  if (!application) throw new Error("지원 정보를 찾을 수 없습니다.");

  const company = (await db
    .prepare(`SELECT * FROM companies WHERE id = ?`)
    .get(application.company_id)) as Company | undefined;
  if (!company) throw new Error("기업 정보를 찾을 수 없습니다.");

  const query = buildRetrievalQuery(company, application, question);

  // 문항에 지정된 경험/이력이 있으면 그 전체 내용을 1순위 재료로 쓰고,
  // 없을 때만 프로필 RAG 검색으로 폴백한다.
  const selectedIds = parseJsonStringArray(question.source_ids ?? "[]");
  let selectedSources: ProfileSource[] = [];
  if (selectedIds.length > 0) {
    const placeholders = selectedIds.map(() => "?").join(",");
    selectedSources = (await db
      .prepare(`SELECT * FROM profile_sources WHERE id IN (${placeholders})`)
      .all(...selectedIds)) as ProfileSource[];
  }

  const [profileHits, sampleHits, companyHits] = await Promise.all([
    selectedSources.length > 0
      ? Promise.resolve([])
      : searchChunks(query, { sourceTypes: ["profile"], topK: 6 }),
    searchChunks(query, { sourceTypes: ["sample_essay"], topK: 3 }),
    searchChunks(query, { sourceTypes: ["company", "company_archive"], topK: 4 }),
  ]);

  const sampleMeta = new Map<string, string>();
  if (sampleHits.length > 0) {
    const ids = [...new Set(sampleHits.map((h) => h.chunk.source_id))];
    const placeholders = ids.map(() => "?").join(",");
    const rows = (await db
      .prepare(`SELECT id, company_name, job_role FROM sample_essays WHERE id IN (${placeholders})`)
      .all(...ids)) as { id: string; company_name: string | null; job_role: string | null }[];
    for (const r of rows) {
      sampleMeta.set(r.id, [r.company_name, r.job_role].filter(Boolean).join(" / "));
    }
  }

  const profileSection =
    selectedSources.length > 0
      ? `\n[이 문항에 사용할 경험/이력 (지원자가 직접 지정 - 반드시 이 내용을 중심으로 작성)]\n${selectedSources
          .map(
            (s, i) =>
              `${i + 1}. [${PROFILE_CATEGORY_LABELS[s.category]}] ${s.title}\n${s.content}`
          )
          .join("\n\n")}\n`
      : formatChunkList(
          "지원자 경험/경력 정보 (RAG 검색 결과)",
          profileHits.map((h) => ({ content: h.chunk.content }))
        );
  const sampleSection = formatChunkList(
    "참고용 우수 자소서 예시 (문체/구성만 참고, 베끼지 말 것)",
    sampleHits.map((h) => ({ content: h.chunk.content, meta: sampleMeta.get(h.chunk.source_id) }))
  );
  const companyExtraSection = formatChunkList(
    "기업 분석 추가 발췌",
    companyHits.map((h) => ({ content: h.chunk.content }))
  );

  const newsList = parseJsonStringArray(company.news ?? "[]");
  const newsSection =
    newsList.length > 0
      ? `\n[기업 주요 뉴스]\n${newsList.map((n, i) => `${i + 1}. ${n}`).join("\n")}\n`
      : "";

  const questionNews = parseJsonStringArray(question.news ?? "[]");
  const questionNewsSection =
    questionNews.length > 0
      ? `\n[이 문항에 활용할 뉴스 기사 (지원자가 직접 첨부 - 답안에 반드시 연결할 것)]\n${questionNews
          .map((n, i) => `${i + 1}. ${n}`)
          .join("\n\n")}\n`
      : "";

  const userPrompt = `[지원 정보]
- 기업: ${company.name}${company.industry ? ` (${company.industry})` : ""}
- 지원 직무: ${application.job_role}
- 기업 분석: ${company.analysis ?? "(등록된 정보 없음)"}
- 인재상: ${company.talent_profile ?? "(등록된 정보 없음)"}
${newsSection}${application.posting ? `\n[채용 공고 (직무 요건·우대사항 참고)]\n${application.posting.slice(0, 3000)}\n` : ""}

[자기소개서 문항]
${question.question_text}
${question.max_length ? `(글자수 제한: ${question.max_length}자)` : ""}
${questionNewsSection}${profileSection}${sampleSection}${companyExtraSection}
${question.content ? `\n[현재까지 작성된 초안 - 이어서 다듬거나 참고]\n${question.content}\n` : ""}
[요청]
위 정보를 종합해 이 문항에 대한 자기소개서 답안을 작성해줘.${conceptHint ? ` 작성 콘셉트: ${conceptHint}` : ""} 답안 본문 외에는 어떤 텍스트도 출력하지 마.`;

  const result = await runClaude(userPrompt, SYSTEM_PROMPT);
  return { text: sanitizeDraft(result.text), costUsd: result.costUsd };
}

// Defense-in-depth: strip common "helpful assistant" wrapper text
// (headings, trailing meta notes) in case the model adds them anyway.
function sanitizeDraft(raw: string): string {
  let text = raw.trim();

  // Drop a trailing "---" section (length notes, alternative offers, etc.)
  const ruleIndex = text.search(/\n\s*---\s*\n/);
  if (ruleIndex !== -1) {
    text = text.slice(0, ruleIndex).trim();
  }

  // Drop a leading markdown heading line (e.g. "# 자기소개서 답안")
  text = text.replace(/^#{1,6}\s.*\n+/, "");

  // Drop a leading bolded restatement of the question (e.g. "**질문...**")
  text = text.replace(/^\*\*.*\*\*\n+/, "");

  return text.trim();
}
