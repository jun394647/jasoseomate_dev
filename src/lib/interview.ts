import { getDb } from "./db";
import { runClaude } from "./claude";
import type { Application, Company, EssayQuestion } from "./types";

const SYSTEM_PROMPT = `당신은 한국 기업 채용 면접관 출신의 면접 코치입니다.
지원자가 제출한 자기소개서를 면접관 관점에서 읽고, 실제 면접에서 나올 법한 예상 질문을 만듭니다.

원칙:
- 자소서에 쓴 경험의 진위·깊이를 검증하는 꼬리질문(구체적 수치, 본인 기여도, 갈등 상황)을 포함한다.
- 자소서에서 두루뭉술하게 넘어간 부분, 논리적 빈틈을 파고드는 질문을 우선한다.
- 기업 인재상·직무와 연결된 질문, 일반 인성 질문도 일부 포함한다.
- 각 질문 아래에 "출제 의도"를 한 줄로 덧붙인다.

출력 형식 (반드시 지킬 것):
1. 질문 내용
   의도: (한 줄)
2. 질문 내용
   의도: (한 줄)
...

총 8~10개. 마크다운 서식(#, **), 이모지 없이 위 번호 목록만 출력한다.`;

export async function generateInterviewQuestions(applicationId: string): Promise<{
  text: string;
  costUsd: number | null;
}> {
  const db = await getDb();
  const application = (await db
    .prepare(`SELECT * FROM applications WHERE id = ?`)
    .get(applicationId)) as Application | undefined;
  if (!application) throw new Error("지원 정보를 찾을 수 없습니다.");

  const company = (await db
    .prepare(`SELECT * FROM companies WHERE id = ?`)
    .get(application.company_id)) as Company | undefined;
  if (!company) throw new Error("기업 정보를 찾을 수 없습니다.");

  const questions = (await db
    .prepare(
      `SELECT * FROM essay_questions WHERE application_id = ? AND TRIM(content) != '' ORDER BY order_index ASC`
    )
    .all(applicationId)) as EssayQuestion[];
  if (questions.length === 0) {
    throw new Error("작성된 답안이 없습니다. 먼저 자소서 답안을 작성하세요.");
  }

  const essayBody = questions
    .map((q, i) => `문항 ${i + 1}. ${q.question_text}\n답안:\n${q.content}`)
    .join("\n\n");

  const userPrompt = `[지원 정보]
- 기업: ${company.name}${company.industry ? ` (${company.industry})` : ""}
- 지원 직무: ${application.job_role}
- 인재상: ${company.talent_profile ?? "(등록된 정보 없음)"}

[제출한 자기소개서]
${essayBody}

[요청]
이 자소서를 기반으로 면접 예상 질문을 만들어줘. 지정된 출력 형식만 사용해.`;

  const result = await runClaude(userPrompt, SYSTEM_PROMPT);
  const text = result.text.trim();

  await db.prepare(
    `UPDATE applications SET interview_questions = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(text, applicationId);

  return { text, costUsd: result.costUsd };
}
