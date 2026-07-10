// 표절 경고: 답안과 우수 자소서 간 문자 단위 중복 검사.
// 임베딩 유사도 대신 결정적인 substring 매칭을 쓴다 (오탐 적음).
import { getDb } from "./db";

const WINDOW = 20; // 이 길이 이상 문장이 그대로 겹치면 표절 위험
const STEP = 10;

export interface PlagiarismHit {
  sample_title: string;
  overlap_text: string;
}

function normalize(text: string): string {
  return text.replace(/\s+/g, "");
}

export async function checkPlagiarism(answer: string): Promise<PlagiarismHit | null> {
  const db = await getDb();
  const samples = (await db
    .prepare(`SELECT company_name, question, content FROM sample_essays`)
    .all()) as { company_name: string | null; question: string; content: string }[];

  const normAnswer = normalize(answer);
  if (normAnswer.length < WINDOW) return null;

  for (const s of samples) {
    const normSample = normalize(s.content);
    for (let i = 0; i + WINDOW <= normAnswer.length; i += STEP) {
      const window = normAnswer.slice(i, i + WINDOW);
      if (normSample.includes(window)) {
        return {
          sample_title: s.company_name ? `[${s.company_name}] ${s.question}` : s.question,
          overlap_text: window,
        };
      }
    }
  }
  return null;
}
