import { NextRequest, NextResponse } from "next/server";
import { exportAll, buildBackupMarkdown, parseBackupMarkdown, importAll } from "@/lib/backup";

// 전체 백업 다운로드 (.md)
export async function GET() {
  try {
    const md = buildBackupMarkdown(await exportAll());
    const filename = `jasoseomate-backup-${new Date().toISOString().slice(0, 10)}.md`;
    return new NextResponse(md, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// 백업 파일 업로드 → 전체 복원 (기존 데이터 대체)
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "백업 파일(.md)이 필요합니다." }, { status: 400 });
    }
    const md = await file.text();
    const dump = parseBackupMarkdown(md);
    const counts = await importAll(dump);
    return NextResponse.json({ ok: true, counts });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
