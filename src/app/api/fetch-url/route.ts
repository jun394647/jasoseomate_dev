import { NextRequest, NextResponse } from "next/server";
import { fetchPageText } from "@/lib/webpage";
import { sessionOrResponse } from "@/lib/session";

export async function POST(req: NextRequest) {
  const session = await sessionOrResponse();
  if (session instanceof NextResponse) return session;

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
