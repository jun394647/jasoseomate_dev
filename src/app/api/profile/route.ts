import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { reindexSource } from "@/lib/rag";
import type { ProfileSource } from "@/lib/types";
import { guardNotion } from "@/lib/notionAuth";

export async function GET(req: NextRequest) {
  const locked = guardNotion(req);
  if (locked) return locked;
  const db = await getDb();
  const rows = (await db
    .prepare(`SELECT * FROM profile_sources ORDER BY updated_at DESC`)
    .all()) as ProfileSource[];
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const locked = guardNotion(req);
  if (locked) return locked;
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
    `INSERT INTO profile_sources (id, title, category, content) VALUES (?, ?, ?, ?)`
  ).run(id, title.trim(), category || "experience", content.trim());

  await reindexSource("profile", id, content.trim());

  const row = await db.prepare(`SELECT * FROM profile_sources WHERE id = ?`).get(id);
  return NextResponse.json(row, { status: 201 });
}
