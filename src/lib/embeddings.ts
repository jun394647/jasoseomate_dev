// GLM 임베딩 API 기반 문장 임베딩 (Vercel 서버리스 대응 — 로컬 모델 없이 API 호출).
// GLM_API_KEY, GLM_BASE_URL(기본 https://open.bigmodel.cn/api/paas/v4),
// GLM_EMBEDDING_MODEL(기본 embedding-3)을 사용한다.

const DEFAULT_BASE_URL = "https://open.bigmodel.cn/api/paas/v4";

interface EmbeddingResponse {
  data?: { embedding?: number[]; index?: number }[];
  error?: { message?: string };
}

async function embed(text: string): Promise<number[]> {
  const apiKey = process.env.GLM_API_KEY;
  if (!apiKey) {
    throw new Error("GLM_API_KEY가 설정되지 않았습니다. .env.local(또는 배포 환경 변수)을 확인하세요.");
  }
  const baseUrl = (process.env.GLM_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const model = process.env.GLM_EMBEDDING_MODEL?.trim() || "embedding-3";

  // GLM 임베딩은 e5 계열과 달리 "query:"/"passage:" 접두사가 필요 없다 — 원문 그대로 보낸다.
  const input = text.replace(/\n+/g, " ").trim();

  const res = await fetch(`${baseUrl}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, input: [input] }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`GLM 임베딩 API 오류 (${res.status}): ${detail.slice(0, 300)}`);
  }

  const data = (await res.json()) as EmbeddingResponse;
  const embedding = data.data?.[0]?.embedding;
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error(`GLM 임베딩 응답 형식이 올바르지 않습니다: ${JSON.stringify(data).slice(0, 200)}`);
  }
  return embedding;
}

export function embedQuery(text: string): Promise<number[]> {
  return embed(text);
}

export function embedPassage(text: string): Promise<number[]> {
  return embed(text);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
