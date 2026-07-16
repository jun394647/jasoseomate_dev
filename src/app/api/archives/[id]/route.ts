import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { deleteSourceChunks } from "@/lib/rag";
import { sessionOrResponse } from "@/lib/session";

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/archives/[id]">) {
  const session = await sessionOrResponse();
  if (session instanceof NextResponse) return session;

  const { id } = await ctx.params;
  const db = await getDb();
  await db
    .prepare(
      `DELETE FROM company_archives WHERE id = ? AND company_id IN
       (SELECT id FROM companies WHERE user_id = ?)`
    )
    .run(id, session.id);
  await deleteSourceChunks("company_archive", id);
  return NextResponse.json({ ok: true });
}
