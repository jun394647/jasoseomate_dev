import { NextRequest, NextResponse } from "next/server";
import { isNotionConfigured, listNotionPages } from "@/lib/notion";
import { guardNotion } from "@/lib/notionAuth";

export async function GET(req: NextRequest) {
  const locked = guardNotion(req);
  if (locked) return locked;
  if (!isNotionConfigured()) {
    return NextResponse.json({ configured: false, pages: [] });
  }
  try {
    const pages = await listNotionPages();
    return NextResponse.json({ configured: true, pages });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
