import { NextRequest, NextResponse } from "next/server";
import { isNotionConfigured, listScraps } from "@/lib/notion";
import { guardNotion } from "@/lib/notionAuth";

export async function GET(req: NextRequest) {
  const locked = guardNotion(req);
  if (locked) return locked;
  if (!isNotionConfigured()) {
    return NextResponse.json({ configured: false, scraps: [] });
  }
  try {
    const scraps = await listScraps();
    return NextResponse.json({ configured: true, scraps });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
