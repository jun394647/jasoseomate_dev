import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { reindexSource } from "@/lib/rag";
import type { SampleEssay } from "@/lib/types";

export async function GET() {
  const db = await getDb();
  const rows = (await db
    .prepare(`SELECT * FROM sample_essays ORDER BY updated_at DESC`)
    .all()) as SampleEssay[];
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { company_name, industry, job_role, question, content, result, memo } = body as {
    company_name?: string;
    industry?: string;
    job_role?: string;
    question?: string;
    content?: string;
    result?: string;
    memo?: string;
  };

  if (!question?.trim() || !content?.trim()) {
    return NextResponse.json({ error: "question and content are required" }, { status: 400 });
  }

  const db = await getDb();
  const id = randomUUID();
  await db.prepare(
    `INSERT INTO sample_essays (id, company_name, industry, job_role, question, content, result, memo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    company_name?.trim() || null,
    industry?.trim() || null,
    job_role?.trim() || null,
    question.trim(),
    content.trim(),
    result || "unknown",
    memo?.trim() || null
  );

  await reindexSource("sample_essay", id, `${question.trim()}\n\n${content.trim()}`);

  const row = await db.prepare(`SELECT * FROM sample_essays WHERE id = ?`).get(id);
  return NextResponse.json(row, { status: 201 });
}
