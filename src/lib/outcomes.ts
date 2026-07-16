// 합불 회고 분석: 결과가 나온 지원서들의 답안을 비교 분석
import { getDb } from "./db";
import { runClaude } from "./claude";

const SYSTEM_PROMPT = `당신은 채용 서류 전형 데이터를 분석하는 취업 컨설턴트입니다.
지원자의 합격 자소서들과 불합격 자소서들을 비교해 패턴을 찾아냅니다.

원칙:
- 표본이 적다는 한계를 인지하고 단정 대신 경향으로 서술한다.
- 문체, 구조(두괄식 여부), 구체성(수치 유무), 직무 연결성, 분량 관점에서 비교한다.
- 실행 가능한 개선 지침으로 마무리한다.

출력 형식 (반드시 이 3개 섹션 제목 그대로, 마크다운·이모지 없이):
[합격 답안의 공통점]
(3~5개 항목, 각 한두 줄)

[불합격 답안의 약점]
(3~5개 항목, 각 한두 줄)

[다음 지원서에 적용할 지침]
(3~5개 항목, 각 한 줄)`;

interface Row {
  status: string;
  company_name: string;
  question_text: string;
  content: string;
}

export async function analyzeOutcomes(userId: string): Promise<{ report: string; costUsd: number | null }> {
  const db = await getDb();
  const rows = (await db
    .prepare(
      `SELECT a.status, c.name AS company_name, q.question_text, q.content
       FROM essay_questions q
       JOIN applications a ON a.id = q.application_id
       JOIN companies c ON c.id = a.company_id
       WHERE a.user_id = ? AND TRIM(q.content) != '' AND a.status IN ('passed_document', 'passed_interview', 'rejected')`
    )
    .all(userId)) as Row[];

  const passed = rows.filter((r) => r.status !== "rejected");
  const rejected = rows.filter((r) => r.status === "rejected");
  if (passed.length === 0 || rejected.length === 0) {
    throw new Error(
      "분석하려면 합격(서류/면접)과 불합격 결과가 각각 1건 이상 필요합니다. 지원서 상태를 먼저 업데이트하세요."
    );
  }

  const format = (list: Row[]) =>
    list
      .slice(0, 8)
      .map((r, i) => `${i + 1}. (${r.company_name}) ${r.question_text}\n${r.content.slice(0, 800)}`)
      .join("\n\n");

  const prompt = `[합격한 지원서의 답안 ${passed.length}건]
${format(passed)}

[불합격한 지원서의 답안 ${rejected.length}건]
${format(rejected)}

[요청]
두 그룹을 비교 분석해줘. 지정된 출력 형식만 사용해.`;

  const result = await runClaude(prompt, SYSTEM_PROMPT);
  return { report: result.text.trim(), costUsd: result.costUsd };
}
