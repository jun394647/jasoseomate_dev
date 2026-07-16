import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { reindexSource } from "@/lib/rag";
import { sessionOrResponse } from "@/lib/session";
import type { ProfileSource } from "@/lib/types";

export async function GET() {
  const session = await sessionOrResponse();
  if (session instanceof NextResponse) return session;

  const db = await getDb();
  const rows = (await db
    .prepare(`SELECT * FROM profile_sources WHERE user_id = ? ORDER BY updated_at DESC`)
    .all(session.id)) as ProfileSource[];
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await sessionOrResponse();
  if (session instanceof NextResponse) return session;

  const body = await req.json();
  const { title, category, content } = body as {
    title?: string;
    category?: string;
    content?: string;
  };

  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json({ error: "title and content are required" }, { status: 400 });
  }

  const db = await getDb();
  const id = randomUUID();
  await db.prepare(
    `INSERT INTO profile_sources (id, user_id, title, category, content) VALUES (?, ?, ?, ?, ?)`
  ).run(id, session.id, title.trim(), category || "experience", content.trim());

  await reindexSource(session.id, "profile", id, content.trim());

  const row = await db.prepare(`SELECT * FROM profile_sources WHERE id = ?`).get(id);
  return NextResponse.json(row, { status: 201 });
}
