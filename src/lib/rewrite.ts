// 답안 리라이트: 글자수 맞춤 압축 / 내 문체로 재작성
import { getDb } from "./db";
import { runClaude } from "./claude";
import type { EssayQuestion, ProfileSource } from "./types";

const SHORTEN_SYSTEM = `당신은 자기소개서 편집 전문가입니다. 주어진 답안을 지정된 글자수 이내로 압축합니다.

원칙:
- 핵심 메시지, 구체적 수치·성과는 반드시 보존한다.
- 수식어, 중복 표현, 부연 설명부터 제거한다.
- 두괄식 구조와 논리 흐름을 유지한다.
- 새로운 내용을 추가하지 않는다.

출력: 압축된 답안 본문만. 마크다운·이모지·부연 설명 금지.`;

const STYLE_SYSTEM = `당신은 자기소개서 문체 교정 전문가입니다. AI가 쓴 듯한 답안을 지원자가 직접 쓴 글처럼 자연스럽게 재작성합니다.

원칙:
- 제공된 지원자의 실제 글(문체 샘플)의 어휘 선택, 문장 길이, 어미 습관, 호흡을 분석해 반영한다.
- 내용, 사실, 수치, 논리 구조는 그대로 유지한다. 문체만 바꾼다.
- 지나치게 매끈한 표현, 상투적 표현("~라고 생각합니다"의 남발, 과한 접속사)을 지원자 스타일로 교체한다.
- 글자수는 원본과 비슷하게 유지한다.

출력: 재작성된 답안 본문만. 마크다운·이모지·부연 설명 금지.`;

async function getQuestion(userId: string, questionId: string): Promise<EssayQuestion> {
  const db = await getDb();
  const q = (await db
    .prepare(
      `SELECT eq.* FROM essay_questions eq
       JOIN applications a ON a.id = eq.application_id
       WHERE eq.id = ? AND a.user_id = ?`
    )
    .get(questionId, userId)) as EssayQuestion | undefined;
  if (!q) throw new Error("문항을 찾을 수 없습니다.");
  if (!q.content.trim()) throw new Error("답안이 비어 있습니다. 먼저 작성하거나 생성하세요.");
  return q;
}

export async function shortenEssay(
  userId: string,
  questionId: string,
  targetLength: number
): Promise<{ text: string; costUsd: number | null }> {
  const q = await getQuestion(userId, questionId);
  const prompt = `[자기소개서 문항]
${q.question_text}

[현재 답안 (${q.content.length}자)]
${q.content}

[요청]
위 답안을 ${targetLength}자 이내로 압축해줘. 반드시 ${targetLength}자를 넘지 마.`;

  const result = await runClaude(prompt, SHORTEN_SYSTEM);
  return { text: result.text.trim(), costUsd: result.costUsd };
}

export async function restyleEssay(
  userId: string,
  questionId: string
): Promise<{ text: string; costUsd: number | null }> {
  const q = await getQuestion(userId, questionId);
  const db = await getDb();
  const samples = (await db
    .prepare(
      `SELECT * FROM profile_sources WHERE user_id = ? AND category = 'etc' ORDER BY updated_at DESC LIMIT 3`
    )
    .all(userId)) as ProfileSource[];
  if (samples.length === 0) {
    throw new Error(
      "문체 샘플이 없습니다. 내 정보의 '기타' 카테고리에 직접 쓴 글(자소서, 블로그 글 등)을 등록하세요."
    );
  }

  const sampleText = samples
    .map((s, i) => `샘플 ${i + 1} (${s.title}):\n${s.content.slice(0, 1500)}`)
    .join("\n\n");

  const prompt = `[지원자가 직접 쓴 글 (문체 샘플)]
${sampleText}

[자기소개서 문항]
${q.question_text}

[재작성할 답안]
${q.content}

[요청]
위 답안을 문체 샘플의 스타일로 재작성해줘. 내용은 유지하고 문체만 바꿔.`;

  const result = await runClaude(prompt, STYLE_SYSTEM);
  return { text: result.text.trim(), costUsd: result.costUsd };
}
