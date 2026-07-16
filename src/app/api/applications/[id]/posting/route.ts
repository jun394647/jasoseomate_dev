import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { fetchScrapContent } from "@/lib/notion";
import { guardNotion } from "@/lib/notionAuth";
import { sessionOrResponse } from "@/lib/session";

// 노션 공고 스크랩(page_id) 또는 직접 입력(posting)을 지원서에 연결
export async function POST(req: NextRequest, ctx: RouteContext<"/api/applications/[id]/posting">) {
  const session = await sessionOrResponse();
  if (session instanceof NextResponse) return session;

  const { id } = await ctx.params;
  const body = await req.json();
  const { page_id, posting, posting_url } = body as {
    page_id?: string;
    posting?: string;
    posting_url?: string;
  };

  if (page_id) {
    const locked = guardNotion(req);
    if (locked) return locked;
  }

  const db = await getDb();
  const app = await db
    .prepare(`SELECT id FROM applications WHERE id = ? AND user_id = ?`)
    .get(id, session.id);
  if (!app) return NextResponse.json({ error: "not found" }, { status: 404 });

  try {
    let finalPosting: string;
    let finalUrl: string | null;

    if (page_id) {
      const scrap = await fetchScrapContent(page_id);
      if (!scrap.content.trim()) {
        throw new Error(`"${scrap.title}" 스크랩 페이지에 본문이 없습니다.`);
      }
      finalPosting = `[${scrap.title}]\n${scrap.content}`;
      finalUrl = scrap.url;
    } else if (posting !== undefined) {
      finalPosting = posting.trim();
      finalUrl = posting_url?.trim() || null;
    } else {
      return NextResponse.json({ error: "page_id 또는 posting이 필요합니다." }, { status: 400 });
    }

    await db.prepare(
      `UPDATE applications SET posting = ?, posting_url = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(finalPosting, finalUrl, id);

    const row = await db.prepare(`SELECT * FROM applications WHERE id = ?`).get(id);
    return NextResponse.json(row);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
