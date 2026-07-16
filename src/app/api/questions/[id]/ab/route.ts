import { NextRequest, NextResponse } from "next/server";
import { generateEssayDraft } from "@/lib/generate";
import { sessionOrResponse } from "@/lib/session";
import { withTokenCharge, InsufficientTokensError } from "@/lib/tokens";

const CONCEPT_A = "지원 직무와 관련된 역량·성과·수치를 전면에 내세우는 직무역량형으로 작성";
const CONCEPT_B = "경험을 통한 성장 과정과 가치관의 변화를 서사적으로 풀어내는 성장서사형으로 작성";

export const maxDuration = 300;

export async function POST(_req: NextRequest, ctx: RouteContext<"/api/questions/[id]/ab">) {
  const session = await sessionOrResponse();
  if (session instanceof NextResponse) return session;

  const { id } = await ctx.params;

  try {
    const [a, b] = await withTokenCharge(session.id, session.role, "essay_ab", () =>
      Promise.all([
        generateEssayDraft(session.id, id, CONCEPT_A),
        generateEssayDraft(session.id, id, CONCEPT_B),
      ])
    );
    return NextResponse.json({
      a: { label: "직무역량형", text: a.text },
      b: { label: "성장서사형", text: b.text },
      costUsd: (a.costUsd ?? 0) + (b.costUsd ?? 0),
    });
  } catch (err) {
    if (err instanceof InsufficientTokensError) {
      return NextResponse.json({ error: err.message }, { status: 402 });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
