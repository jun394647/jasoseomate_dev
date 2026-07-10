// 1분 자기소개 생성: 등록된 경험 + 기업/공고 정보 기반
import { getDb } from "./db";
import { runClaude } from "./claude";
import { searchChunks } from "./rag";
import type { Application, Company } from "./types";

const SYSTEM_PROMPT = `당신은 면접 스피치 코치입니다. 지원자의 경험과 지원 기업 정보를 바탕으로 면접용 1분 자기소개를 작성합니다.

원칙:
- 말하기 기준 1분 분량(공백 포함 500~650자)으로 작성한다.
- 구어체로, 실제로 소리 내어 말할 수 있는 자연스러운 문장으로 쓴다.
- 두괄식: 지원 직무와 연결된 핵심 강점 한 문장으로 시작한다.
- 가장 강력한 경험 1~2개를 수치와 함께 언급한다.
- 지원 기업·직무와의 연결로 마무리한다.
- 제공된 정보에 없는 사실을 지어내지 않는다.

출력: 자기소개 본문만. 마크다운·이모지·부연 설명 금지.`;

export async function generateSelfIntro(applicationId: string): Promise<{
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

  const query = [company.name, company.industry, application.job_role, "강점 성과 경험"].filter(Boolean).join(" ");
  const hits = await searchChunks(query, { sourceTypes: ["profile"], topK: 8 });
  if (hits.length === 0) throw new Error("등록된 경험이 없습니다. 내 정보를 먼저 채우세요.");

  const prompt = `[지원 정보]
- 기업: ${company.name}${company.industry ? ` (${company.industry})` : ""}
- 지원 직무: ${application.job_role}
- 인재상: ${company.talent_profile ?? "(등록된 정보 없음)"}
${application.posting ? `\n[채용 공고 발췌]\n${application.posting.slice(0, 2000)}\n` : ""}
[지원자 경험 (검색 결과)]
${hits.map((h, i) => `${i + 1}. ${h.chunk.content}`).join("\n\n")}

[요청]
이 지원자의 면접용 1분 자기소개를 작성해줘.`;

  const result = await runClaude(prompt, SYSTEM_PROMPT);
  const text = result.text.trim();

  await db.prepare(`UPDATE applications SET self_intro = ?, updated_at = datetime('now') WHERE id = ?`).run(
    text,
    applicationId
  );
  return { text, costUsd: result.costUsd };
}
