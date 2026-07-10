import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { reindexSource } from "@/lib/rag";
import type { CompanyArchive } from "@/lib/types";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/companies/[id]/archives">) {
  const { id } = await ctx.params;
  const db = await getDb();
  const rows = (await db
    .prepare(`SELECT * FROM company_archives WHERE company_id = ? ORDER BY created_at DESC`)
    .all(id)) as CompanyArchive[];
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest, ctx: RouteContext<"/api/companies/[id]/archives">) {
  const { id: companyId } = await ctx.params;
  const body = await req.json();
  const { title, content, url } = body as { title?: string; content?: string; url?: string };

  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json({ error: "title and content are required" }, { status: 400 });
  }

  const db = await getDb();
  const company = await db.prepare(`SELECT id FROM companies WHERE id = ?`).get(companyId);
  if (!company) {
    return NextResponse.json({ error: "company not found" }, { status: 404 });
  }

  const id = randomUUID();
  await db.prepare(
    `INSERT INTO company_archives (id, company_id, title, content, url) VALUES (?, ?, ?, ?, ?)`
  ).run(id, companyId, title.trim(), content.trim(), url?.trim() || null);

  await reindexSource("company_archive", id, `${title.trim()}\n\n${content.trim()}`);

  const row = await db.prepare(`SELECT * FROM company_archives WHERE id = ?`).get(id);
  return NextResponse.json(row, { status: 201 });
}
