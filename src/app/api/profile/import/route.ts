import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sessionOrResponse } from "@/lib/session";
import { parseProfileMarkdown } from "@/lib/profileExport";
import { reindexSource } from "@/lib/rag";
import type { ProfileSource } from "@/lib/types";

// MD 불러오기는 기존 항목을 지우지 않고 추가만 한다 (전체 백업 복원과 다른 점).
export async function POST(req: NextRequest) {
  const session = await sessionOrResponse();
  if (session instanceof NextResponse) return session;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "md 파일이 필요합니다." }, { status: 400 });
  }

  const md = await file.text();
  const rows = parseProfileMarkdown(md);
  if (rows.length === 0) {
    return NextResponse.json({ error: "파일에서 불러올 항목을 찾지 못했습니다." }, { status: 400 });
  }

  const db = await getDb();
  const created: ProfileSource[] = [];
  for (const row of rows) {
    await db
      .prepare(
        `INSERT INTO profile_sources (id, user_id, title, category, content) VALUES (?, ?, ?, ?, ?)`
      )
      .run(row.id, session.id, row.title, row.category, row.content);
    await reindexSource(session.id, "profile", row.id, row.content);
    created.push(
      (await db.prepare(`SELECT * FROM profile_sources WHERE id = ?`).get(row.id)) as ProfileSource
    );
  }

  return NextResponse.json({ created }, { status: 201 });
}
