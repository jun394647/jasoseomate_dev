import Link from "next/link";
import { Search } from "lucide-react";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { Card, PageHeader, EmptyState } from "@/components/ui";
import { PROFILE_CATEGORY_LABELS } from "@/lib/types";
import type { ProfileCategory } from "@/lib/types";

interface ResultItem {
  href: string;
  group: string;
  title: string;
  snippet: string;
}

function makeSnippet(text: string, q: string, radius = 60): string {
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text.slice(0, radius * 2);
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + q.length + radius);
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const session = await getSession();
  if (!session) {
    return (
      <div>
        <PageHeader title="검색" />
        <EmptyState>로그인이 필요합니다.</EmptyState>
      </div>
    );
  }

  const { q: rawQ } = await searchParams;
  const q = (Array.isArray(rawQ) ? rawQ[0] : rawQ)?.trim() ?? "";

  const results: ResultItem[] = [];

  if (q) {
    const db = await getDb();
    const like = `%${q}%`;
    const userId = session.id;

    const profiles = (await db
      .prepare(
        `SELECT id, title, category, content FROM profile_sources
         WHERE user_id = ? AND (title LIKE ? OR content LIKE ?) ORDER BY updated_at DESC LIMIT 10`
      )
      .all(userId, like, like)) as { id: string; title: string; category: ProfileCategory; content: string }[];
    for (const p of profiles) {
      results.push({
        href: "/profile",
        group: `내 정보 · ${PROFILE_CATEGORY_LABELS[p.category]}`,
        title: p.title,
        snippet: makeSnippet(p.content, q),
      });
    }

    const samples = (await db
      .prepare(
        `SELECT id, company_name, question, content FROM sample_essays
         WHERE user_id = ? AND (question LIKE ? OR content LIKE ? OR company_name LIKE ?) ORDER BY updated_at DESC LIMIT 10`
      )
      .all(userId, like, like, like)) as { id: string; company_name: string | null; question: string; content: string }[];
    for (const s of samples) {
      results.push({
        href: "/samples",
        group: "우수 자소서",
        title: `${s.company_name ? `[${s.company_name}] ` : ""}${s.question}`,
        snippet: makeSnippet(s.content, q),
      });
    }

    const companies = (await db
      .prepare(
        `SELECT id, name, industry, COALESCE(analysis, '') || ' ' || COALESCE(talent_profile, '') || ' ' || ai_report AS body
         FROM companies
         WHERE user_id = ? AND (name LIKE ? OR analysis LIKE ? OR talent_profile LIKE ? OR ai_report LIKE ? OR news LIKE ?)
         ORDER BY updated_at DESC LIMIT 10`
      )
      .all(userId, like, like, like, like, like)) as { id: string; name: string; industry: string | null; body: string }[];
    for (const c of companies) {
      results.push({
        href: "/companies",
        group: "기업 분석",
        title: `${c.name}${c.industry ? ` (${c.industry})` : ""}`,
        snippet: makeSnippet(c.body.trim(), q),
      });
    }

    const archives = (await db
      .prepare(
        `SELECT ar.id, ar.title, ar.content, c.name AS company_name
         FROM company_archives ar JOIN companies c ON c.id = ar.company_id
         WHERE c.user_id = ? AND (ar.title LIKE ? OR ar.content LIKE ?) ORDER BY ar.created_at DESC LIMIT 10`
      )
      .all(userId, like, like)) as { id: string; title: string; content: string; company_name: string }[];
    for (const a of archives) {
      results.push({
        href: "/companies",
        group: `아카이브 · ${a.company_name}`,
        title: a.title,
        snippet: makeSnippet(a.content, q),
      });
    }

    const questions = (await db
      .prepare(
        `SELECT q.id, q.question_text, q.content, q.application_id, c.name AS company_name, a.job_role
         FROM essay_questions q
         JOIN applications a ON a.id = q.application_id
         JOIN companies c ON c.id = a.company_id
         WHERE a.user_id = ? AND (q.question_text LIKE ? OR q.content LIKE ? OR q.memo LIKE ?) ORDER BY q.updated_at DESC LIMIT 10`
      )
      .all(userId, like, like, like)) as {
      id: string;
      question_text: string;
      content: string;
      application_id: string;
      company_name: string;
      job_role: string;
    }[];
    for (const qu of questions) {
      results.push({
        href: `/applications/${qu.application_id}`,
        group: `자소서 문항 · ${qu.company_name} ${qu.job_role}`,
        title: qu.question_text,
        snippet: makeSnippet(qu.content || "(미작성)", q),
      });
    }
  }

  return (
    <div>
      <PageHeader title="검색" description="경험, 자소서, 기업 정보, 아카이브를 한 번에 검색합니다." />

      <form method="get" className="mb-6">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#898781]" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="검색어를 입력하고 Enter (예: 프로젝트, 기업명, 문항 키워드)"
            className="w-full rounded-lg border border-[rgba(11,11,11,0.15)] dark:border-[rgba(255,255,255,0.15)] bg-transparent pl-9 pr-3 py-2.5 text-sm text-[#0b0b0b] dark:text-white placeholder:text-[#898781] focus:outline-none focus:ring-2 focus:ring-[#2a78d6]/40"
          />
        </div>
      </form>

      {!q ? (
        <EmptyState>검색어를 입력하세요.</EmptyState>
      ) : results.length === 0 ? (
        <EmptyState>&ldquo;{q}&rdquo;에 대한 결과가 없습니다.</EmptyState>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-[#898781] mb-2">{results.length}건의 결과</p>
          {results.map((r, i) => (
            <Link key={i} href={r.href} className="block">
              <Card className="p-3.5 hover:border-[#2a78d6]/40 transition-colors">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#2a78d6] dark:text-[#3987e5] mb-0.5">
                  {r.group}
                </p>
                <p className="text-sm font-medium text-[#0b0b0b] dark:text-white">{r.title}</p>
                <p className="text-xs text-[#52514e] dark:text-[#c3c2b7] mt-0.5 line-clamp-2">{r.snippet}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
