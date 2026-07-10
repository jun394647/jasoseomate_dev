import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { reindexSource, deleteSourceChunks } from "@/lib/rag";

export async function PUT(req: NextRequest, ctx: RouteContext<"/api/companies/[id]">) {
  const { id } = await ctx.params;
  const body = await req.json();
  const { name, industry, analysis, talent_profile, notes, news } = body as {
    name?: string;
    industry?: string;
    analysis?: string;
    talent_profile?: string;
    notes?: string;
    news?: string[];
  };

  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const newsList = (news ?? []).map((n) => n.trim()).filter(Boolean);

  const db = await getDb();
  const res = await db
    .prepare(
      `UPDATE companies SET name = ?, industry = ?, analysis = ?, talent_profile = ?, notes = ?, news = ?, updated_at = datetime('now')
       WHERE id = ?`
    )
    .run(
      name.trim(),
      industry?.trim() || null,
      analysis?.trim() || null,
      talent_profile?.trim() || null,
      notes?.trim() || null,
      JSON.stringify(newsList),
      id
    );

  if (res.changes === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const ragText = [analysis, talent_profile, ...newsList].filter(Boolean).join("\n\n");
  if (ragText.trim()) {
    await reindexSource("company", id, ragText.trim());
  } else {
    await deleteSourceChunks("company", id);
  }

  const row = await db.prepare(`SELECT * FROM companies WHERE id = ?`).get(id);
  return NextResponse.json(row);
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/companies/[id]">) {
  const { id } = await ctx.params;
  const db = await getDb();
  const archiveIds = (await db
    .prepare(`SELECT id FROM company_archives WHERE company_id = ?`)
    .all(id)) as { id: string }[];
  await db.prepare(`DELETE FROM companies WHERE id = ?`).run(id);
  await deleteSourceChunks("company", id);
  for (const a of archiveIds) await deleteSourceChunks("company_archive", a.id);
  return NextResponse.json({ ok: true });
}
