// 전체 데이터 MD 백업/복원.
// 배포 환경(무료 티어)은 디스크가 휘발성이므로, 모든 테이블을 하나의 .md 파일로
// 내려받고 다시 올려 복원한다. 사람이 읽을 요약 + 기계용 JSON 블록 구조.
import type { InValue } from "@libsql/client";
import { getDb } from "./db";

const TABLES = [
  "profile_sources",
  "sample_essays",
  "companies",
  "company_archives",
  "applications",
  "essay_questions",
  "essay_versions",
  "interview_answers",
  "chunks", // 임베딩 포함 — 복원 시 재인덱싱 불필요
  "meta",
] as const;

type Dump = {
  version: 1;
  exported_at: string;
  tables: Record<string, Record<string, unknown>[]>;
};

export async function exportAll(): Promise<Dump> {
  const db = await getDb();
  const tables: Dump["tables"] = {};
  for (const t of TABLES) {
    tables[t] = (await db.prepare(`SELECT * FROM ${t}`).all()) as Record<string, unknown>[];
  }
  return { version: 1, exported_at: new Date().toISOString(), tables };
}

export function buildBackupMarkdown(dump: Dump): string {
  const t = dump.tables;
  const summary = [
    `# 자소서메이트 전체 백업`,
    ``,
    `- 내보낸 시각: ${new Date(dump.exported_at).toLocaleString("ko-KR")}`,
    `- 내 정보: ${t.profile_sources.length}건 · 우수 자소서: ${t.sample_essays.length}건 · 기업: ${t.companies.length}건 (아카이브 ${t.company_archives.length}건)`,
    `- 지원서: ${t.applications.length}건 · 문항: ${t.essay_questions.length}건 · 버전 기록: ${t.essay_versions.length}건 · 면접 연습: ${t.interview_answers.length}건`,
    ``,
    `이 파일을 자소서메이트의 "백업 복원"에 올리면 전체 데이터가 그대로 복원됩니다.`,
    `아래 JSON 블록은 수정하지 마세요.`,
    ``,
    `## DATA`,
    ``,
    "```json",
    JSON.stringify(dump),
    "```",
    ``,
  ];
  return summary.join("\n");
}

export function parseBackupMarkdown(md: string): Dump {
  const match = md.match(/```json\s*([\s\S]*?)```/);
  if (!match) throw new Error("백업 파일에서 JSON 데이터 블록을 찾지 못했습니다.");
  let dump: Dump;
  try {
    dump = JSON.parse(match[1]) as Dump;
  } catch {
    throw new Error("백업 JSON 파싱에 실패했습니다. 파일이 수정되지 않았는지 확인하세요.");
  }
  if (dump.version !== 1 || !dump.tables) {
    throw new Error("지원하지 않는 백업 파일 형식입니다.");
  }
  return dump;
}

export async function importAll(dump: Dump): Promise<Record<string, number>> {
  const db = await getDb();
  const counts: Record<string, number> = {};

  // libsql batch로 전체 삭제 + 삽입을 하나의 배치로 실행 (원자성 최선 노력)
  const stmts: { sql: string; args?: InValue[] }[] = [];

  // FK 역순으로 삭제
  for (const t of [...TABLES].reverse()) {
    stmts.push({ sql: `DELETE FROM ${t}` });
  }
  for (const t of TABLES) {
    const rows = dump.tables[t] ?? [];
    counts[t] = rows.length;
    if (rows.length === 0) continue;
    const cols = Object.keys(rows[0]);
    const sql = `INSERT INTO ${t} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`;
    for (const row of rows) {
      stmts.push({ sql, args: cols.map((c) => (row[c] ?? null) as InValue) });
    }
  }

  await db.batch(stmts);
  return counts;
}
