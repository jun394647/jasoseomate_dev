// 면접 답변 연습: 답변에 대한 면접관 평가 + 꼬리질문
import { randomUUID } from "node:crypto";
import { getDb } from "./db";
import { runClaude } from "./claude";
import type { Application, Company, InterviewAnswer } from "./types";

const SYSTEM_PROMPT = `당신은 한국 기업의 압박·구조화 면접에 능한 현직 면접관입니다. 지원자의 면접 답변을 평가합니다.

출력 형식 (반드시 이 3개 섹션 제목 그대로, 마크다운·이모지 없이):
[평가]
(10점 만점 점수와 근거 2~3문장. 두괄식 여부, 구체성, 질문 의도 부합 여부를 본다)

[개선 제안]
(답변을 어떻게 고치면 좋을지 1~3개, 예시 문장 포함)

[꼬리질문]
(이 답변을 들은 면접관이 이어서 던질 날카로운 질문 2개)`;

export async function evaluateInterviewAnswer(
  userId: string,
  applicationId: string,
  questionText: string,
  answer: string
): Promise<{ record: InterviewAnswer; costUsd: number | null }> {
  const db = await getDb();
  const application = (await db
    .prepare(`SELECT * FROM applications WHERE id = ? AND user_id = ?`)
    .get(applicationId, userId)) as Application | undefined;
  if (!application) throw new Error("지원 정보를 찾을 수 없습니다.");
  const company = (await db
    .prepare(`SELECT * FROM companies WHERE id = ?`)
    .get(application.company_id)) as Company | undefined;

  const prompt = `[지원 정보]
- 기업: ${company?.name ?? ""} / 직무: ${application.job_role}
- 인재상: ${company?.talent_profile ?? "(정보 없음)"}

[면접 질문]
${questionText}

[지원자 답변]
${answer}

[요청]
위 답변을 평가해줘. 지정된 출력 형식만 사용해.`;

  const result = await runClaude(prompt, SYSTEM_PROMPT);
  const feedback = result.text.trim();

  const id = randomUUID();
  await db.prepare(
    `INSERT INTO interview_answers (id, application_id, question_text, answer, feedback) VALUES (?, ?, ?, ?, ?)`
  ).run(id, applicationId, questionText, answer, feedback);

  const record = (await db
    .prepare(`SELECT * FROM interview_answers WHERE id = ?`)
    .get(id)) as InterviewAnswer;
  return { record, costUsd: result.costUsd };
}
