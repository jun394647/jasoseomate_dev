import { randomUUID } from "node:crypto";
import { getDb } from "./db";
import { embedPassage, embedQuery, cosineSimilarity } from "./embeddings";
import type { Chunk, ChunkSourceType } from "./types";

const CHUNK_SIZE = 700;
const CHUNK_OVERLAP = 100;

export function chunkText(text: string): string[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (!clean) return [];

  const paragraphs = clean.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if ((current + "\n\n" + para).length <= CHUNK_SIZE) {
      current = current ? `${current}\n\n${para}` : para;
      continue;
    }
    if (current) chunks.push(current);

    if (para.length <= CHUNK_SIZE) {
      current = para;
    } else {
      // paragraph itself is too long: hard-split with overlap
      let start = 0;
      while (start < para.length) {
        const end = Math.min(start + CHUNK_SIZE, para.length);
        chunks.push(para.slice(start, end));
        if (end === para.length) {
          current = "";
          break;
        }
        start = end - CHUNK_OVERLAP;
      }
      current = "";
    }
  }
  if (current) chunks.push(current);

  return chunks.length ? chunks : [clean];
}

export async function reindexSource(
  userId: string,
  sourceType: ChunkSourceType,
  sourceId: string,
  text: string
): Promise<void> {
  const db = await getDb();
  await db.prepare(`DELETE FROM chunks WHERE source_type = ? AND source_id = ?`).run(
    sourceType,
    sourceId
  );

  const pieces = chunkText(text);
  if (pieces.length === 0) return;

  const insert = db.prepare(
    `INSERT INTO chunks (id, user_id, source_type, source_id, content, embedding) VALUES (?, ?, ?, ?, ?, ?)`
  );

  for (const piece of pieces) {
    let vector: number[];
    try {
      vector = await embedPassage(piece);
    } catch (err) {
      // 임베딩 API를 쓸 수 없는 환경(키에 임베딩 권한 없음 등)에서는 인덱싱만 건너뛴다.
      // 저장 자체는 성공시키고, RAG 검색은 빈 결과로 동작한다.
      console.warn(
        `[rag] 임베딩 사용 불가 — ${sourceType}/${sourceId} 인덱싱 건너뜀: ${(err as Error).message}`
      );
      return;
    }
    await insert.run(randomUUID(), userId, sourceType, sourceId, piece, JSON.stringify(vector));
  }
}

export async function deleteSourceChunks(
  sourceType: ChunkSourceType,
  sourceId: string
): Promise<void> {
  const db = await getDb();
  await db.prepare(`DELETE FROM chunks WHERE source_type = ? AND source_id = ?`).run(
    sourceType,
    sourceId
  );
}

export interface RetrievedChunk {
  chunk: Chunk;
  score: number;
}

export async function searchChunks(
  userId: string,
  query: string,
  options: { sourceTypes?: ChunkSourceType[]; topK?: number; excludeSourceId?: string } = {}
): Promise<RetrievedChunk[]> {
  const db = await getDb();
  const { sourceTypes, topK = 6, excludeSourceId } = options;

  let rows: Chunk[];
  if (sourceTypes && sourceTypes.length > 0) {
    const placeholders = sourceTypes.map(() => "?").join(",");
    rows = (await db
      .prepare(`SELECT * FROM chunks WHERE user_id = ? AND source_type IN (${placeholders})`)
      .all(userId, ...sourceTypes)) as Chunk[];
  } else {
    rows = (await db.prepare(`SELECT * FROM chunks WHERE user_id = ?`).all(userId)) as Chunk[];
  }

  if (excludeSourceId) {
    rows = rows.filter((r) => r.source_id !== excludeSourceId);
  }
  if (rows.length === 0) return [];

  let queryVector: number[];
  try {
    queryVector = await embedQuery(query);
  } catch (err) {
    console.warn(`[rag] 임베딩 사용 불가 — 검색 결과 없이 진행: ${(err as Error).message}`);
    return [];
  }
  const scored = rows.map((chunk) => ({
    chunk,
    score: cosineSimilarity(queryVector, JSON.parse(chunk.embedding) as number[]),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}
