// Notion 연동: 공식 REST API로 지원서(자소서 전체)를 노션 페이지로 내보낸다.
// NOTION_API_KEY (Integration Secret)와 NOTION_PARENT_PAGE_ID가 .env.local에 있어야 한다.

import { getDb } from "./db";
import { parseJsonStringArray } from "./types";
import { APPLICATION_STATUS_LABELS } from "./types";
import type { Application, Company, EssayQuestion } from "./types";

const NOTION_VERSION = "2022-06-28";
const MAX_RICH_TEXT = 1800; // Notion rich_text 항목당 2000자 제한에 여유를 둠
const MAX_BLOCKS_PER_REQUEST = 100;

type NotionBlock = Record<string, unknown>;

export function isNotionConfigured(): boolean {
  return Boolean(process.env.NOTION_API_KEY && process.env.NOTION_PARENT_PAGE_ID);
}

function richText(text: string) {
  return [{ type: "text", text: { content: text } }];
}

function paragraphs(text: string): NotionBlock[] {
  const blocks: NotionBlock[] = [];
  const clean = text.trim();
  if (!clean) return blocks;
  for (const para of clean.split(/\n{2,}/)) {
    for (let i = 0; i < para.length; i += MAX_RICH_TEXT) {
      blocks.push({
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: richText(para.slice(i, i + MAX_RICH_TEXT)) },
      });
    }
  }
  return blocks;
}

function heading(level: 2 | 3, text: string): NotionBlock {
  const key = `heading_${level}`;
  return { object: "block", type: key, [key]: { rich_text: richText(text) } };
}

function callout(emoji: string, text: string): NotionBlock {
  return {
    object: "block",
    type: "callout",
    callout: {
      icon: { type: "emoji", emoji },
      rich_text: richText(text.slice(0, MAX_RICH_TEXT)),
    },
  };
}

const DIVIDER: NotionBlock = { object: "block", type: "divider", divider: {} };

async function notionFetch(path: string, method: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = (await res.json().catch(() => ({}))) as { message?: string; code?: string };
    if (res.status === 404 || detail.code === "object_not_found") {
      throw new Error(
        "노션 페이지를 찾을 수 없습니다. '자소서메이트 백업' 페이지의 연결(Connections)에 Integration을 추가했는지 확인하세요."
      );
    }
    if (res.status === 401) {
      throw new Error("노션 API 키가 올바르지 않습니다. .env.local의 NOTION_API_KEY를 확인하세요.");
    }
    throw new Error(`노션 API 오류 (${res.status}): ${detail.message ?? "unknown"}`);
  }
  return res.json();
}

interface NotionSearchResult {
  id: string;
  url: string;
  archived: boolean;
  last_edited_time: string;
  parent: { type: string; page_id?: string };
  properties?: { title?: { title?: { plain_text: string }[] } };
}

interface NotionBlockResult {
  id: string;
  type: string;
  has_children: boolean;
  [key: string]: unknown;
}

function blockToText(block: NotionBlockResult): string {
  const data = block[block.type] as { rich_text?: { plain_text: string }[]; checked?: boolean } | undefined;
  const text = (data?.rich_text ?? []).map((t) => t.plain_text).join("");
  switch (block.type) {
    case "heading_1":
    case "heading_2":
    case "heading_3":
      return text ? `[${text}]` : "";
    case "bulleted_list_item":
    case "numbered_list_item":
      return text ? `- ${text}` : "";
    case "to_do":
      return text ? `${data?.checked ? "[완료]" : "[ ]"} ${text}` : "";
    case "quote":
    case "callout":
      return text ? `> ${text}` : "";
    default:
      return text;
  }
}

async function fetchBlocksText(blockId: string, depth: number): Promise<string[]> {
  const lines: string[] = [];
  let cursor: string | undefined;

  do {
    const qs = cursor ? `?page_size=100&start_cursor=${cursor}` : "?page_size=100";
    const data = (await notionFetch(`/blocks/${blockId}/children${qs}`, "GET")) as {
      results: NotionBlockResult[];
      has_more: boolean;
      next_cursor: string | null;
    };
    for (const block of data.results) {
      if (block.type === "child_page" || block.type === "child_database") continue;
      const line = blockToText(block);
      if (line) lines.push(line);
      if (block.has_children && depth < 2) {
        const childLines = await fetchBlocksText(block.id, depth + 1);
        lines.push(...childLines.map((l) => `  ${l}`));
      }
    }
    cursor = data.has_more ? (data.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return lines;
}

// 노션 페이지 제목 + 본문을 일반 텍스트로 가져온다
export async function fetchNotionPageContent(pageId: string): Promise<{ title: string; content: string }> {
  if (!isNotionConfigured()) {
    throw new Error("노션 연동이 설정되지 않았습니다. .env.local의 NOTION_API_KEY를 확인하세요.");
  }
  const page = (await notionFetch(`/pages/${pageId}`, "GET")) as NotionSearchResult;
  const title = page.properties?.title?.title?.map((t) => t.plain_text).join("") || "(제목 없음)";
  const lines = await fetchBlocksText(pageId, 0);
  return { title, content: lines.join("\n") };
}

async function getMeta(key: string): Promise<string | null> {
  const db = await getDb();
  const row = (await db.prepare(`SELECT value FROM meta WHERE key = ?`).get(key)) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

async function setMeta(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db
    .prepare(`INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
    .run(key, value);
}

// ───── 공고 스크랩 DB 연동 ─────

interface NotionPropertyValue {
  type: string;
  title?: { plain_text: string }[];
  rich_text?: { plain_text: string }[];
  url?: string | null;
}

interface NotionDbPage {
  id: string;
  url: string;
  last_edited_time: string;
  properties: Record<string, NotionPropertyValue>;
}

async function findScrapDatabaseId(): Promise<string> {
  const cached = await getMeta("notion_scrap_db_id");
  if (cached) return cached;

  const data = (await notionFetch("/search", "POST", {
    query: "공고 스크랩",
    filter: { value: "database", property: "object" },
    page_size: 10,
  })) as { results: { id: string; title?: { plain_text: string }[] }[] };

  const hit = data.results.find((r) =>
    (r.title ?? []).map((t) => t.plain_text).join("").includes("공고 스크랩")
  );
  if (!hit) {
    throw new Error(
      "'공고 스크랩' 데이터베이스를 찾지 못했습니다. Integration이 연결된 페이지 하위에 있는지, 데이터베이스 연결(Connections)에 Integration이 추가됐는지 확인하세요."
    );
  }
  await setMeta("notion_scrap_db_id", hit.id);
  return hit.id;
}

export interface ScrapSummary {
  id: string;
  title: string;
  url: string | null;
  notion_url: string;
  last_edited: string;
}

export async function listScraps(): Promise<ScrapSummary[]> {
  if (!isNotionConfigured()) throw new Error("노션 연동이 설정되지 않았습니다.");
  const dbId = await findScrapDatabaseId();
  const data = (await notionFetch(`/databases/${dbId}/query`, "POST", {
    page_size: 50,
    sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
  })) as { results: NotionDbPage[] };

  return data.results.map((p) => {
    const props = Object.values(p.properties);
    const titleProp = props.find((v) => v.type === "title");
    const urlProp = props.find((v) => v.type === "url");
    return {
      id: p.id,
      title: (titleProp?.title ?? []).map((t) => t.plain_text).join("") || "(제목 없음)",
      url: urlProp?.url ?? null,
      notion_url: p.url,
      last_edited: p.last_edited_time,
    };
  });
}

// 스크랩 페이지 본문 + URL 속성 가져오기
export async function fetchScrapContent(pageId: string): Promise<{
  title: string;
  content: string;
  url: string | null;
}> {
  const page = (await notionFetch(`/pages/${pageId}`, "GET")) as NotionDbPage;
  const props = Object.values(page.properties);
  const titleProp = props.find((v) => v.type === "title");
  const urlProp = props.find((v) => v.type === "url");
  const { content } = await fetchNotionPageContent(pageId);
  return {
    title: (titleProp?.title ?? []).map((t) => t.plain_text).join("") || "(제목 없음)",
    content,
    url: urlProp?.url ?? null,
  };
}

// ───── 지원 현황 노션 DB 동기화 ─────

import { APPLICATION_STATUS_LABELS as STATUS_LABELS } from "./types";
import type { ApplicationWithCompany } from "./types";

async function ensureApplicationsDatabase(): Promise<string> {
  const cached = await getMeta("notion_apps_db_id");
  if (cached) return cached;

  const created = (await notionFetch("/databases", "POST", {
    parent: { type: "page_id", page_id: process.env.NOTION_PARENT_PAGE_ID },
    icon: { type: "emoji", emoji: "🗂️" },
    title: richText("자소서메이트 지원 현황"),
    properties: {
      지원: { title: {} },
      상태: {
        select: { options: Object.values(STATUS_LABELS).map((name) => ({ name })) },
      },
      마감일: { date: {} },
      직무: { rich_text: {} },
    },
  })) as { id: string };

  await setMeta("notion_apps_db_id", created.id);
  return created.id;
}

export async function syncApplicationsToNotion(): Promise<{ created: number; updated: number }> {
  if (!isNotionConfigured()) throw new Error("노션 연동이 설정되지 않았습니다.");
  const db = await getDb();
  const apps = (await db
    .prepare(
      `SELECT a.*, c.name AS company_name, c.industry AS industry
       FROM applications a JOIN companies c ON c.id = a.company_id ORDER BY a.updated_at DESC`
    )
    .all()) as ApplicationWithCompany[];
  if (apps.length === 0) throw new Error("동기화할 지원서가 없습니다.");

  const dbId = await ensureApplicationsDatabase();
  let created = 0;
  let updated = 0;

  for (const app of apps) {
    const properties = {
      지원: { title: richText(`${app.company_name} · ${app.job_role}`) },
      상태: { select: { name: STATUS_LABELS[app.status] } },
      마감일: app.deadline ? { date: { start: app.deadline } } : { date: null },
      직무: { rich_text: richText(app.job_role) },
    };

    const pageKey = `notion_page:${app.id}`;
    const existingPageId = await getMeta(pageKey);
    if (existingPageId) {
      try {
        await notionFetch(`/pages/${existingPageId}`, "PATCH", { properties });
        updated++;
        continue;
      } catch {
        // 페이지가 삭제된 경우 새로 생성
      }
    }
    const page = (await notionFetch("/pages", "POST", {
      parent: { database_id: dbId },
      properties,
    })) as { id: string };
    await setMeta(pageKey, page.id);
    created++;
  }

  return { created, updated };
}

export async function exportApplicationToNotion(applicationId: string): Promise<{ url: string }> {
  if (!isNotionConfigured()) {
    throw new Error(
      "노션 연동이 설정되지 않았습니다. .env.local에 NOTION_API_KEY를 설정하고 서버를 재시작하세요. (notion.so/my-integrations에서 발급)"
    );
  }

  const db = await getDb();
  const application = (await db
    .prepare(`SELECT * FROM applications WHERE id = ?`)
    .get(applicationId)) as Application | undefined;
  if (!application) throw new Error("지원 정보를 찾을 수 없습니다.");

  const company = (await db
    .prepare(`SELECT * FROM companies WHERE id = ?`)
    .get(application.company_id)) as Company | undefined;
  if (!company) throw new Error("기업 정보를 찾을 수 없습니다.");

  const questions = (await db
    .prepare(`SELECT * FROM essay_questions WHERE application_id = ? ORDER BY order_index ASC`)
    .all(applicationId)) as EssayQuestion[];

  const blocks: NotionBlock[] = [
    callout(
      "📌",
      `직무: ${application.job_role} · 상태: ${APPLICATION_STATUS_LABELS[application.status]}` +
        (application.deadline ? ` · 마감: ${application.deadline}` : "") +
        ` · 내보낸 시각: ${new Date().toLocaleString("ko-KR")}`
    ),
  ];

  questions.forEach((q, i) => {
    blocks.push(DIVIDER);
    blocks.push(heading(2, `${i + 1}. ${q.question_text}`));
    if (q.max_length) {
      blocks.push(callout("🔢", `글자수 제한 ${q.max_length}자 · 현재 ${q.content.length}자`));
    }
    if (q.content.trim()) {
      blocks.push(...paragraphs(q.content));
    } else {
      blocks.push(...paragraphs("(미작성)"));
    }
    if (q.memo.trim()) {
      blocks.push(heading(3, "메모"));
      blocks.push(callout("📝", q.memo));
    }
    if (q.feedback.trim()) {
      blocks.push(heading(3, "AI 첨삭"));
      blocks.push(...paragraphs(q.feedback));
    }
    const news = parseJsonStringArray(q.news ?? "[]");
    if (news.length > 0) {
      blocks.push(heading(3, "첨부 뉴스"));
      for (const n of news) blocks.push(callout("📰", n));
    }
  });

  const page = (await notionFetch("/pages", "POST", {
    parent: { page_id: process.env.NOTION_PARENT_PAGE_ID },
    icon: { type: "emoji", emoji: "📄" },
    properties: {
      title: { title: richText(`${company.name} · ${application.job_role} 자기소개서`) },
    },
    children: blocks.slice(0, MAX_BLOCKS_PER_REQUEST),
  })) as { id: string; url: string };

  // 100블록 초과분은 append API로 이어 붙인다
  for (let i = MAX_BLOCKS_PER_REQUEST; i < blocks.length; i += MAX_BLOCKS_PER_REQUEST) {
    await notionFetch(`/blocks/${page.id}/children`, "PATCH", {
      children: blocks.slice(i, i + MAX_BLOCKS_PER_REQUEST),
    });
  }

  return { url: page.url };
}
