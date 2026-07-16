import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sessionOrResponse } from "@/lib/session";
import { cosineSimilarity } from "@/lib/embeddings";
import type { ProfileSource, Chunk } from "@/lib/types";

const EDGE_THRESHOLD = 0.75;

export interface ProfileGraphNode {
  id: string;
  title: string;
  category: ProfileSource["category"];
  content: string;
}

export interface ProfileGraphEdge {
  source: string;
  target: string;
  weight: number;
}

function averageVector(vectors: number[][]): number[] | null {
  if (vectors.length === 0) return null;
  const len = vectors[0].length;
  const sum = new Array(len).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < len && i < v.length; i++) sum[i] += v[i];
  }
  return sum.map((v) => v / vectors.length);
}

export async function GET() {
  const session = await sessionOrResponse();
  if (session instanceof NextResponse) return session;

  const db = await getDb();
  const sources = (await db
    .prepare(`SELECT * FROM profile_sources WHERE user_id = ? ORDER BY category, updated_at DESC`)
    .all(session.id)) as ProfileSource[];

  const nodes: ProfileGraphNode[] = sources.map((s) => ({
    id: s.id,
    title: s.title,
    category: s.category,
    content: s.content,
  }));

  if (sources.length < 2) {
    return NextResponse.json({ nodes, edges: [] });
  }

  const chunks = (await db
    .prepare(`SELECT * FROM chunks WHERE user_id = ? AND source_type = 'profile'`)
    .all(session.id)) as Chunk[];

  const vectorsBySource = new Map<string, number[][]>();
  for (const c of chunks) {
    try {
      const vec = JSON.parse(c.embedding) as number[];
      const list = vectorsBySource.get(c.source_id) ?? [];
      list.push(vec);
      vectorsBySource.set(c.source_id, list);
    } catch {
      // 손상된 임베딩은 건너뜀
    }
  }

  const repVectors = new Map<string, number[]>();
  for (const [sourceId, vectors] of vectorsBySource) {
    const avg = averageVector(vectors);
    if (avg) repVectors.set(sourceId, avg);
  }

  const edges: ProfileGraphEdge[] = [];
  const ids = [...repVectors.keys()];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const sim = cosineSimilarity(repVectors.get(ids[i])!, repVectors.get(ids[j])!);
      if (sim >= EDGE_THRESHOLD) {
        edges.push({ source: ids[i], target: ids[j], weight: sim });
      }
    }
  }

  return NextResponse.json({ nodes, edges });
}
