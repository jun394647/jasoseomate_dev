import { NextRequest, NextResponse } from "next/server";
import { fetchPageText } from "@/lib/webpage";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { url } = body as { url?: string };
  if (!url?.trim()) {
    return NextResponse.json({ error: "url이 필요합니다." }, { status: 400 });
  }
  try {
    const { title, text } = await fetchPageText(url.trim());
    return NextResponse.json({ title, text });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
