import { getDb } from "./db";
import { runClaude } from "./claude";
import { parseJsonStringArray } from "./types";
import type { Application, Company, EssayQuestion } from "./types";

const SYSTEM_PROMPT = `당신은 한국 채용시장에 정통한 자기소개서 첨삭 전문가입니다.
지원자가 작성한 자소서 답안을 문항 의도, 기업 인재상, 직무 적합성, 글자수 제한 관점에서 냉정하게 검토하고
실행 가능한 첨삭 피드백을 제공합니다.

원칙:
- 칭찬을 위한 칭찬을 하지 않는다. 고칠 점이 있으면 구체적으로 지적한다.
- 추상적 조언("더 구체적으로 쓰세요")이 아니라, 어느 문장을 어떻게 바꿔야 하는지 예시를 들어 제안한다.
- 문항이 묻는 것에 답하고 있는지(동문서답 여부)를 최우선으로 확인한다.
- 두괄식 구성, 구체적 수치·성과, 기업/직무 연결고리 유무를 점검한다.
- 글자수 제한 대비 현재 분량의 적절성을 언급한다.

출력 형식 (반드시 지킬 것, 각 섹션 제목 그대로 사용):
[총평]
(2~3문장 요약 평가와 10점 만점 점수. 예: 7/10)

[강점]
(잘 쓴 부분 1~3개, 각 한 줄)

[개선점]
(고쳐야 할 부분 1~4개. 각 항목은 "문제 → 수정 제안" 구조로, 실제 문장 예시 포함)

[문항 적합성]
(문항 의도에 맞게 답했는지 1~2문장)

마크다운 서식(#, **), 이모지를 사용하지 않는다. 위 4개 섹션 외 어떤 텍스트도 출력하지 않는다.`;

export async function reviewEssay(questionId: string): Promise<{
  feedback: string;
  costUsd: number | null;
}> {
  const db = await getDb();
  const question = (await db
    .prepare(`SELECT * FROM essay_questions WHERE id = ?`)
    .get(questionId)) as EssayQuestion | undefined;
  if (!question) throw new Error("문항을 찾을 수 없습니다.");
  if (!question.content.trim()) throw new Error("첨삭할 답안이 없습니다. 먼저 답안을 작성하거나 생성하세요.");

  const application = (await db
    .prepare(`SELECT * FROM applications WHERE id = ?`)
    .get(question.application_id)) as Application | undefined;
  if (!application) throw new Error("지원 정보를 찾을 수 없습니다.");

  const company = (await db
    .prepare(`SELECT * FROM companies WHERE id = ?`)
    .get(application.company_id)) as Company | undefined;
  if (!company) throw new Error("기업 정보를 찾을 수 없습니다.");

  const newsList = parseJsonStringArray(company.news ?? "[]");
  const newsSection =
    newsList.length > 0
      ? `\n[기업 주요 뉴스]\n${newsList.map((n, i) => `${i + 1}. ${n}`).join("\n")}\n`
      : "";

  const userPrompt = `[지원 정보]
- 기업: ${company.name}${company.industry ? ` (${company.industry})` : ""}
- 지원 직무: ${application.job_role}
- 기업 분석: ${company.analysis ?? "(등록된 정보 없음)"}
- 인재상: ${company.talent_profile ?? "(등록된 정보 없음)"}
${newsSection}

[자기소개서 문항]
${question.question_text}
${question.max_length ? `(글자수 제한: ${question.max_length}자 / 현재 ${question.content.length}자)` : `(현재 ${question.content.length}자)`}
${(() => {
  const qNews = parseJsonStringArray(question.news ?? "[]");
  return qNews.length > 0
    ? `\n[이 문항에 첨부된 뉴스 기사 (답안이 이 기사들과 잘 연결됐는지도 평가할 것)]\n${qNews
        .map((n, i) => `${i + 1}. ${n}`)
        .join("\n\n")}\n`
    : "";
})()}

[작성된 답안]
${question.content}

[요청]
위 답안을 첨삭해줘. 지정된 출력 형식만 사용해.`;

  const result = await runClaude(userPrompt, SYSTEM_PROMPT);
  const feedback = stripMarkdown(result.text);

  await db.prepare(`UPDATE essay_questions SET feedback = ?, updated_at = datetime('now') WHERE id = ?`).run(
    feedback,
    questionId
  );

  return { feedback, costUsd: result.costUsd };
}

// Defense-in-depth: the panel renders plain text, so strip markdown the model
// sometimes emits despite the system prompt (headings, bold markers).
function stripMarkdown(raw: string): string {
  return raw
    .trim()
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1");
}
