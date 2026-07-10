import { NextRequest, NextResponse } from "next/server";
import { extractTextFromFile } from "@/lib/parse";

// Parses an uploaded company-info file and returns its text so the client
// can fill the analysis field before saving. No DB write here.
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let text: string;
  try {
    text = (await extractTextFromFile(buffer, file.name)).trim();
  } catch (err) {
    return NextResponse.json(
      { error: `파일 파싱 실패: ${(err as Error).message}` },
      { status: 400 }
    );
  }

  if (!text) {
    return NextResponse.json({ error: "파일에서 텍스트를 추출하지 못했습니다." }, { status: 400 });
  }

  return NextResponse.json({ text });
}
