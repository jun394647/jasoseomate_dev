import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { reindexSource } from "@/lib/rag";
import { fetchNotionPageContent } from "@/lib/notion";
import { PROFILE_CATEGORY_LABELS } from "@/lib/types";
import type { ProfileCategory, ProfileSource } from "@/lib/types";
import { guardNotion } from "@/lib/notionAuth";

export async function POST(req: NextRequest) {
  const locked = guardNotion(req);
  if (locked) return locked;
  const body = await req.json();
  const { page_ids, category } = body as { page_ids?: string[]; category?: string };

  if (!page_ids?.length) {
    return NextResponse.json({ error: "page_ids is required" }, { status: 400 });
  }
  if (!category || !(category in PROFILE_CATEGORY_LABELS)) {
    return NextResponse.json({ error: "valid category is required" }, { status: 400 });
  }

  const db = await getDb();
  const created: ProfileSource[] = [];
  const failed: { page_id: string; error: string }[] = [];

  for (const pageId of page_ids) {
    try {
      const { title, content } = await fetchNotionPageContent(pageId);
      if (!content.trim()) {
        failed.push({ page_id: pageId, error: `"${title}" 페이지에서 텍스트를 찾지 못했습니다.` });
        continue;
      }
      const id = randomUUID();
      await db.prepare(
        `INSERT INTO profile_sources (id, title, category, content) VALUES (?, ?, ?, ?)`
      ).run(id, title, category as ProfileCategory, content);
      await reindexSource("profile", id, content);
      created.push(
        (await db.prepare(`SELECT * FROM profile_sources WHERE id = ?`).get(id)) as ProfileSource
      );
    } catch (err) {
      failed.push({ page_id: pageId, error: (err as Error).message });
    }
  }

  if (created.length === 0) {
    return NextResponse.json(
      { error: failed[0]?.error ?? "가져오기에 실패했습니다.", failed },
      { status: 500 }
    );
  }
  return NextResponse.json({ created, failed }, { status: 201 });
}
