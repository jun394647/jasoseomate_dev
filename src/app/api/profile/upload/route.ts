import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { reindexSource } from "@/lib/rag";
import { extractTextFromFile } from "@/lib/parse";
import { guardNotion } from "@/lib/notionAuth";

export async function POST(req: NextRequest) {
  const locked = guardNotion(req);
  if (locked) return locked;
  const form = await req.formData();
  const file = form.get("file");
  const title = (form.get("title") as string) || "";
  const category = (form.get("category") as string) || "experience";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let content: string;
  try {
    content = (await extractTextFromFile(buffer, file.name)).trim();
  } catch (err) {
    return NextResponse.json(
      { error: `파일 파싱 실패: ${(err as Error).message}` },
      { status: 400 }
    );
  }

  if (!content) {
    return NextResponse.json({ error: "파일에서 텍스트를 추출하지 못했습니다." }, { status: 400 });
  }

  const db = await getDb();
  const id = randomUUID();
  await db.prepare(
    `INSERT INTO profile_sources (id, title, category, content) VALUES (?, ?, ?, ?)`
  ).run(id, title.trim() || file.name, category, content);

  await reindexSource("profile", id, content);

  const row = await db.prepare(`SELECT * FROM profile_sources WHERE id = ?`).get(id);
  return NextResponse.json(row, { status: 201 });
}
