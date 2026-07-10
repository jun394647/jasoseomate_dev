// DB 접근 계층: @libsql/client 기반 async 어댑터.
// - 로컬 개발: TURSO_DATABASE_URL 미설정 시 file:data/app.db 폴백 (기존과 동일하게 동작)
// - 배포(Vercel): TURSO_DATABASE_URL + TURSO_AUTH_TOKEN 으로 Turso 호스팅 DB 사용
// 기존 better-sqlite3 호출 형태(db.prepare(sql).get/all/run, db.exec)를 유지하되 전부 async.
import { createClient, type Client, type InValue } from "@libsql/client";
import path from "node:path";
import fs from "node:fs";

export interface Statement {
  get(...args: InValue[]): Promise<unknown>;
  all(...args: InValue[]): Promise<unknown[]>;
  run(...args: InValue[]): Promise<{ changes: number }>;
}

export interface DbAdapter {
  prepare(sql: string): Statement;
  /** 세미콜론으로 구분된 여러 SQL 문을 순차 실행 */
  exec(sql: string): Promise<void>;
  /** 여러 문장을 하나의 배치(원자성 최선 노력)로 실행 */
  batch(stmts: { sql: string; args?: InValue[] }[]): Promise<void>;
  client: Client;
}

const DEFAULT_FILE_URL = "file:data/app.db";

function resolveUrl(): { url: string; isFile: boolean } {
  const url = process.env.TURSO_DATABASE_URL?.trim() || DEFAULT_FILE_URL;
  return { url, isFile: url.startsWith("file:") };
}

// libsql Row → 순수 객체 (JSON 직렬화/스프레드 안전)
function toPlainRow(columns: string[], row: Record<number, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (let i = 0; i < columns.length; i++) {
    let v = (row as unknown[])[i];
    if (typeof v === "bigint") v = Number(v);
    out[columns[i]] = v;
  }
  return out;
}

function createAdapterFor(client: Client): DbAdapter {
  return {
    client,
    prepare(sql: string): Statement {
      return {
        async get(...args: InValue[]) {
          const rs = await client.execute({ sql, args });
          if (rs.rows.length === 0) return undefined;
          return toPlainRow(rs.columns, rs.rows[0]);
        },
        async all(...args: InValue[]) {
          const rs = await client.execute({ sql, args });
          return rs.rows.map((r) => toPlainRow(rs.columns, r));
        },
        async run(...args: InValue[]) {
          const rs = await client.execute({ sql, args });
          return { changes: rs.rowsAffected };
        },
      };
    },
    async exec(sql: string) {
      await client.executeMultiple(sql);
    },
    async batch(stmts) {
      if (stmts.length === 0) return;
      await client.batch(
        stmts.map((s) => ({ sql: s.sql, args: s.args ?? [] })),
        "write"
      );
    },
  };
}

async function connect(): Promise<DbAdapter> {
  const { url, isFile } = resolveUrl();

  if (isFile) {
    // file: 모드일 때만 data 디렉터리를 만든다 (Vercel 서버리스 FS는 휘발성)
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  const client = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  const db = createAdapterFor(client);

  if (isFile) {
    try {
      await client.executeMultiple(`PRAGMA journal_mode = WAL;`);
    } catch {
      // journal_mode 변경 실패는 치명적이지 않다
    }
  }
  try {
    await client.executeMultiple(`PRAGMA foreign_keys = ON;`);
  } catch {
    // Turso(hrana)에서는 지원되지 않을 수 있음 — 서버 기본값에 위임
  }

  await migrate(db);
  if (isFile) await backupDaily(db, url);
  return db;
}

// 하루 1회, 서버 시작 시 data/backups/에 스냅샷을 남긴다 (최근 10개 유지, file: 모드 전용)
async function backupDaily(db: DbAdapter, url: string) {
  try {
    const rel = url.slice("file:".length).replace(/^\/\//, "");
    const dbPath = path.isAbsolute(rel) ? rel : path.join(process.cwd(), rel);
    const backupDir = path.join(path.dirname(dbPath), "backups");
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const today = new Date().toISOString().slice(0, 10);
    const target = path.join(backupDir, `app-${today}.db`);
    if (fs.existsSync(target)) return;

    try {
      await db.exec(`PRAGMA wal_checkpoint(TRUNCATE);`);
    } catch {
      // checkpoint 실패해도 파일 복사는 시도
    }
    fs.copyFileSync(dbPath, target);

    const files = fs
      .readdirSync(backupDir)
      .filter((f) => f.startsWith("app-") && f.endsWith(".db"))
      .sort();
    for (const f of files.slice(0, -10)) {
      fs.unlinkSync(path.join(backupDir, f));
    }
  } catch (err) {
    console.error("DB backup failed:", err);
  }
}

async function migrate(db: DbAdapter) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS profile_sources (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'experience',
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sample_essays (
      id TEXT PRIMARY KEY,
      company_name TEXT,
      industry TEXT,
      job_role TEXT,
      question TEXT NOT NULL,
      content TEXT NOT NULL,
      result TEXT NOT NULL DEFAULT 'unknown',
      memo TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      industry TEXT,
      analysis TEXT,
      talent_profile TEXT,
      notes TEXT,
      news TEXT NOT NULL DEFAULT '[]',
      ai_report TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS company_archives (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      job_role TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'preparing',
      deadline TEXT,
      notes TEXT,
      interview_questions TEXT NOT NULL DEFAULT '',
      posting TEXT NOT NULL DEFAULT '',
      posting_url TEXT,
      self_intro TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS essay_questions (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
      question_text TEXT NOT NULL,
      max_length INTEGER,
      order_index INTEGER NOT NULL DEFAULT 0,
      content TEXT NOT NULL DEFAULT '',
      memo TEXT NOT NULL DEFAULT '',
      feedback TEXT NOT NULL DEFAULT '',
      source_ids TEXT NOT NULL DEFAULT '[]',
      news TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS essay_versions (
      id TEXT PRIMARY KEY,
      question_id TEXT NOT NULL REFERENCES essay_questions(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual',
      cost_usd REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS interview_answers (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
      question_text TEXT NOT NULL,
      answer TEXT NOT NULL,
      feedback TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      content TEXT NOT NULL,
      embedding TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_chunks_source ON chunks(source_type, source_id);
    CREATE INDEX IF NOT EXISTS idx_archives_company ON company_archives(company_id);
    CREATE INDEX IF NOT EXISTS idx_applications_company ON applications(company_id);
    CREATE INDEX IF NOT EXISTS idx_questions_application ON essay_questions(application_id);
    CREATE INDEX IF NOT EXISTS idx_versions_question ON essay_versions(question_id);
  `);

  // legacy profile categories -> current 정보/이력/경력/경험/기타 scheme
  await db.exec(`
    UPDATE profile_sources SET category = 'history' WHERE category = 'education';
    UPDATE profile_sources SET category = 'etc' WHERE category IN ('project', 'skill');
  `);

  const questionColumns = (await db
    .prepare(`SELECT name FROM pragma_table_info('essay_questions')`)
    .all()) as { name: string }[];
  if (!questionColumns.some((c) => c.name === "memo")) {
    await db.exec(`ALTER TABLE essay_questions ADD COLUMN memo TEXT NOT NULL DEFAULT ''`);
  }
  if (!questionColumns.some((c) => c.name === "feedback")) {
    await db.exec(`ALTER TABLE essay_questions ADD COLUMN feedback TEXT NOT NULL DEFAULT ''`);
  }
  if (!questionColumns.some((c) => c.name === "source_ids")) {
    await db.exec(`ALTER TABLE essay_questions ADD COLUMN source_ids TEXT NOT NULL DEFAULT '[]'`);
  }
  if (!questionColumns.some((c) => c.name === "news")) {
    await db.exec(`ALTER TABLE essay_questions ADD COLUMN news TEXT NOT NULL DEFAULT '[]'`);
  }

  const applicationColumns = (await db
    .prepare(`SELECT name FROM pragma_table_info('applications')`)
    .all()) as { name: string }[];
  if (!applicationColumns.some((c) => c.name === "interview_questions")) {
    await db.exec(`ALTER TABLE applications ADD COLUMN interview_questions TEXT NOT NULL DEFAULT ''`);
  }
  if (!applicationColumns.some((c) => c.name === "posting")) {
    await db.exec(`ALTER TABLE applications ADD COLUMN posting TEXT NOT NULL DEFAULT ''`);
    await db.exec(`ALTER TABLE applications ADD COLUMN posting_url TEXT`);
    await db.exec(`ALTER TABLE applications ADD COLUMN self_intro TEXT NOT NULL DEFAULT ''`);
  }

  const companyColumns = (await db
    .prepare(`SELECT name FROM pragma_table_info('companies')`)
    .all()) as { name: string }[];
  if (!companyColumns.some((c) => c.name === "news")) {
    await db.exec(`ALTER TABLE companies ADD COLUMN news TEXT NOT NULL DEFAULT '[]'`);
  }
  if (!companyColumns.some((c) => c.name === "ai_report")) {
    await db.exec(`ALTER TABLE companies ADD COLUMN ai_report TEXT NOT NULL DEFAULT ''`);
  }
}

declare global {
  // 첫 연결 시 migrate() 1회 실행을 보장하기 위한 Promise 캐시
  var __jasoseomateDbPromise: Promise<DbAdapter> | undefined;
}

export function getDb(): Promise<DbAdapter> {
  if (!globalThis.__jasoseomateDbPromise) {
    globalThis.__jasoseomateDbPromise = connect().catch((err) => {
      // 연결/마이그레이션 실패 시 다음 요청에서 재시도할 수 있게 캐시를 비운다
      globalThis.__jasoseomateDbPromise = undefined;
      throw err;
    });
  }
  return globalThis.__jasoseomateDbPromise;
}
