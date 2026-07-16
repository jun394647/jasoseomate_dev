import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { exportApplicationToNotion, isNotionConfigured } from "@/lib/notion";
import { guardNotion, isNotionUnlocked } from "@/lib/notionAuth";
import { sessionOrResponse } from "@/lib/session";

export async function GET(req: NextRequest) {
  return NextResponse.json({ configured: isNotionConfigured() && isNotionUnlocked(req) });
}

export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/applications/[id]/export-notion">
) {
  const session = await sessionOrResponse();
  if (session instanceof NextResponse) return session;

  const locked = guardNotion(req);
  if (locked) return locked;

  const { id } = await ctx.params;
  const db = await getDb();

  const application = await db
    .prepare(`SELECT id FROM applications WHERE id = ? AND user_id = ?`)
    .get(id, session.id);
  if (!application) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  try {
    const { url } = await exportApplicationToNotion(id);
    return NextResponse.json({ url });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
