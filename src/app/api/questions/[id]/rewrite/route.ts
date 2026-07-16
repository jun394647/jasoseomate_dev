import { NextRequest, NextResponse } from "next/server";
import { shortenEssay, restyleEssay } from "@/lib/rewrite";
import { sessionOrResponse } from "@/lib/session";

export const maxDuration = 300;

export async function POST(req: NextRequest, ctx: RouteContext<"/api/questions/[id]/rewrite">) {
  const session = await sessionOrResponse();
  if (session instanceof NextResponse) return session;

  const { id } = await ctx.params;
  const body = await req.json();
  const { mode, target_length } = body as { mode?: string; target_length?: number };

  try {
    let result: { text: string; costUsd: number | null };
    if (mode === "shorten") {
      if (!target_length || target_length < 50) {
        return NextResponse.json({ error: "목표 글자수(50자 이상)를 지정하세요." }, { status: 400 });
      }
      result = await shortenEssay(session.id, id, target_length);
    } else if (mode === "style") {
      result = await restyleEssay(session.id, id);
    } else {
      return NextResponse.json({ error: "mode는 shorten 또는 style이어야 합니다." }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
