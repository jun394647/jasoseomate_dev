import { NextRequest, NextResponse } from "next/server";
import { syncApplicationsToNotion } from "@/lib/notion";
import { guardNotion } from "@/lib/notionAuth";

export async function POST(req: NextRequest) {
  const locked = guardNotion(req);
  if (locked) return locked;
  try {
    const result = await syncApplicationsToNotion();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
