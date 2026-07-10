import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { generateEssayDraft } from "@/lib/generate";

const CONCEPT_A = "지원 직무와 관련된 역량·성과·수치를 전면에 내세우는 직무역량형으로 작성";
const CONCEPT_B = "경험을 통한 성장 과정과 가치관의 변화를 서사적으로 풀어내는 성장서사형으로 작성";

export const maxDuration = 300;

export async function POST(_req: NextRequest, ctx: RouteContext<"/api/questions/[id]/ab">) {
  const { id } = await ctx.params;
  const db = await getDb();
  const question = await db.prepare(`SELECT id FROM essay_questions WHERE id = ?`).get(id);
  if (!question) return NextResponse.json({ error: "not found" }, { status: 404 });

  try {
    const [a, b] = await Promise.all([
      generateEssayDraft(id, CONCEPT_A),
      generateEssayDraft(id, CONCEPT_B),
    ]);
    return NextResponse.json({
      a: { label: "직무역량형", text: a.text },
      b: { label: "성장서사형", text: b.text },
      costUsd: (a.costUsd ?? 0) + (b.costUsd ?? 0),
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
