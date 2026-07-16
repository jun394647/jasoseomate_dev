import { NextRequest, NextResponse } from "next/server";
import { exportAll, buildBackupMarkdown, parseBackupMarkdown, importAll } from "@/lib/backup";
import { adminSessionOrResponse } from "@/lib/session";

// 전체 백업 다운로드 (.md) — 관리자 전용 (DB 전체를 덤프하므로 모든 회원 데이터가 포함됨)
export async function GET() {
  const session = await adminSessionOrResponse();
  if (session instanceof NextResponse) return session;

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

// 백업 파일 업로드 → 전체 복원 (기존 데이터 대체) — 관리자 전용
export async function POST(req: NextRequest) {
  const session = await adminSessionOrResponse();
  if (session instanceof NextResponse) return session;

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
