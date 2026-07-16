import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sessionOrResponse } from "@/lib/session";
import { buildProfileMarkdown } from "@/lib/profileExport";
import type { ProfileSource } from "@/lib/types";

export async function GET() {
  const session = await sessionOrResponse();
  if (session instanceof NextResponse) return session;

  const db = await getDb();
  const sources = (await db
    .prepare(`SELECT * FROM profile_sources WHERE user_id = ? ORDER BY category, updated_at DESC`)
    .all(session.id)) as ProfileSource[];

  const md = buildProfileMarkdown(sources);
  const filename = `내정보-${new Date().toISOString().slice(0, 10)}.md`;
  return new NextResponse(md, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  });
}
