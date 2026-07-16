import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sessionOrResponse } from "@/lib/session";
import type { ProfileSource } from "@/lib/types";

export interface ProfileGraphNode {
  id: string;
  title: string;
  category: ProfileSource["category"];
  content: string;
}

// 지식그래프는 카테고리 트리 구조(루트 → 카테고리 → 항목)로만 그려서,
// 임베딩 유사도 기반 교차 연결(복잡하고 뜻을 알기 어렵다는 피드백을 받음)은 쓰지 않는다.
// 트리 엣지는 카테고리만으로 결정되므로 서버에서 별도 엣지 계산이 필요 없다.
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

  return NextResponse.json({ nodes });
}
