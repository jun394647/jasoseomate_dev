import { NextRequest, NextResponse } from "next/server";
import { shortenEssay, restyleEssay } from "@/lib/rewrite";
import { sessionOrResponse } from "@/lib/session";
import { withTokenCharge, InsufficientTokensError } from "@/lib/tokens";

export const maxDuration = 300;

export async function POST(req: NextRequest, ctx: RouteContext<"/api/questions/[id]/rewrite">) {
  const session = await sessionOrResponse();
  if (session instanceof NextResponse) return session;

  const { id } = await ctx.params;
  const body = await req.json();
  const { mode, target_length } = body as { mode?: string; target_length?: number };

  if (mode !== "shorten" && mode !== "style") {
    return NextResponse.json({ error: "mode는 shorten 또는 style이어야 합니다." }, { status: 400 });
  }
  if (mode === "shorten" && (!target_length || target_length < 50)) {
    return NextResponse.json({ error: "목표 글자수(50자 이상)를 지정하세요." }, { status: 400 });
  }

  try {
    const result = await withTokenCharge(session.id, session.role, "essay_rewrite", () =>
      mode === "shorten" ? shortenEssay(session.id, id, target_length!) : restyleEssay(session.id, id)
    );
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof InsufficientTokensError) {
      return NextResponse.json({ error: err.message }, { status: 402 });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
