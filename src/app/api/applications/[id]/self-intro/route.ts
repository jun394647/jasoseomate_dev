import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { generateSelfIntro } from "@/lib/selfIntro";

export const maxDuration = 300;

export async function POST(_req: NextRequest, ctx: RouteContext<"/api/applications/[id]/self-intro">) {
  const { id } = await ctx.params;
  const db = await getDb();
  const app = await db.prepare(`SELECT id FROM applications WHERE id = ?`).get(id);
  if (!app) return NextResponse.json({ error: "not found" }, { status: 404 });

  try {
    const { text, costUsd } = await generateSelfIntro(id);
    return NextResponse.json({ self_intro: text, costUsd });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
