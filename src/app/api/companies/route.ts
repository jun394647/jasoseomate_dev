import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { reindexSource } from "@/lib/rag";
import type { Company } from "@/lib/types";

export async function GET() {
  const db = await getDb();
  const rows = (await db.prepare(`SELECT * FROM companies ORDER BY updated_at DESC`).all()) as Company[];
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
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
  const id = randomUUID();
  await db.prepare(
    `INSERT INTO companies (id, name, industry, analysis, talent_profile, notes, news) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    name.trim(),
    industry?.trim() || null,
    analysis?.trim() || null,
    talent_profile?.trim() || null,
    notes?.trim() || null,
    JSON.stringify(newsList)
  );

  const ragText = [analysis, talent_profile, ...newsList].filter(Boolean).join("\n\n");
  if (ragText.trim()) await reindexSource("company", id, ragText.trim());

  const row = await db.prepare(`SELECT * FROM companies WHERE id = ?`).get(id);
  return NextResponse.json(row, { status: 201 });
}
