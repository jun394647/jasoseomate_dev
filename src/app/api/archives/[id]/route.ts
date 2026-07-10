import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { deleteSourceChunks } from "@/lib/rag";

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/archives/[id]">) {
  const { id } = await ctx.params;
  const db = await getDb();
  await db.prepare(`DELETE FROM company_archives WHERE id = ?`).run(id);
  await deleteSourceChunks("company_archive", id);
  return NextResponse.json({ ok: true });
}
