import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { exportApplicationToNotion, isNotionConfigured } from "@/lib/notion";
import { guardNotion, isNotionUnlocked } from "@/lib/notionAuth";

export async function GET(req: NextRequest) {
  return NextResponse.json({ configured: isNotionConfigured() && isNotionUnlocked(req) });
}

export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/applications/[id]/export-notion">
) {
  const locked = guardNotion(req);
  if (locked) return locked;

  const { id } = await ctx.params;
  const db = await getDb();

  const application = await db.prepare(`SELECT id FROM applications WHERE id = ?`).get(id);
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
