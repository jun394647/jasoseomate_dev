import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { Card, PageHeader, EmptyState } from "@/components/ui";
import { PROFILE_CATEGORY_LABELS, parseJsonStringArray } from "@/lib/types";
import type { ProfileCategory } from "@/lib/types";
import OutcomeAnalysis from "./OutcomeAnalysis";
import QuestionBank from "./QuestionBank";

export default async function InsightsPage() {
  const session = await getSession();
  if (!session) {
    return (
      <div>
        <PageHeader title="인사이트" />
        <EmptyState>로그인이 필요합니다.</EmptyState>
      </div>
    );
  }

  const db = await getDb();

  // 경험 활용 맵: 문항의 source_ids를 집계
  const sources = (await db
    .prepare(`SELECT id, title, category FROM profile_sources WHERE user_id = ? ORDER BY category, updated_at DESC`)
    .all(session.id)) as { id: string; title: string; category: ProfileCategory }[];
  const questionSourceRows = (await db
    .prepare(
      `SELECT q.source_ids FROM essay_questions q
       JOIN applications a ON a.id = q.application_id
       WHERE a.user_id = ? AND q.source_ids != '[]'`
    )
    .all(session.id)) as { source_ids: string }[];

  const usage = new Map<string, number>();
  for (const row of questionSourceRows) {
    for (const id of parseJsonStringArray(row.source_ids)) {
      usage.set(id, (usage.get(id) ?? 0) + 1);
    }
  }
  const usedSources = sources
    .filter((s) => (usage.get(s.id) ?? 0) > 0)
    .sort((a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0));
  const unusedExperiences = sources.filter(
    (s) => (s.category === "experience" || s.category === "career") && !(usage.get(s.id) ?? 0)
  );

  // 문항 은행
  const questions = (await db
    .prepare(
      `SELECT q.id, q.question_text, q.max_length, c.name AS company_name, a.job_role, a.status
       FROM essay_questions q
       JOIN applications a ON a.id = q.application_id
       JOIN companies c ON c.id = a.company_id
       WHERE a.user_id = ?
       ORDER BY q.created_at DESC`
    )
    .all(session.id)) as {
    id: string;
    question_text: string;
    max_length: number | null;
    company_name: string;
    job_role: string;
    status: string;
  }[];

  return (
    <div>
      <PageHeader
        title="인사이트"
        description="경험 활용 현황, 합불 패턴 분석, 문항 은행을 한곳에서 확인하세요."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card className="p-5">
          <h2 className="text-sm font-medium mb-3 text-[#0b0b0b] dark:text-white">경험 활용 맵</h2>
          {usedSources.length === 0 ? (
            <EmptyState>아직 문항에 연결된 경험이 없습니다. 문항의 &ldquo;경험 선택&rdquo;을 활용해보세요.</EmptyState>
          ) : (
            <ul className="space-y-2">
              {usedSources.map((s) => {
                const count = usage.get(s.id) ?? 0;
                return (
                  <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate">
                      <span className="text-xs text-[#898781] mr-1.5">
                        [{PROFILE_CATEGORY_LABELS[s.category]}]
                      </span>
                      <span className="text-[#0b0b0b] dark:text-white">{s.title}</span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        count >= 4
                          ? "bg-[#d03b3b]/10 text-[#d03b3b]"
                          : "bg-[#2a78d6]/10 text-[#2a78d6] dark:text-[#3987e5]"
                      }`}
                    >
                      {count}회{count >= 4 ? " · 과사용 주의" : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {unusedExperiences.length > 0 && (
            <div className="mt-4 border-t border-[rgba(11,11,11,0.10)] dark:border-[rgba(255,255,255,0.10)] pt-3">
              <p className="text-xs font-medium text-[#898781] mb-2">
                아직 안 쓴 경험/경력 ({unusedExperiences.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {unusedExperiences.slice(0, 12).map((s) => (
                  <span
                    key={s.id}
                    className="rounded-full border border-[rgba(11,11,11,0.15)] dark:border-[rgba(255,255,255,0.15)] px-2.5 py-1 text-xs text-[#52514e] dark:text-[#c3c2b7]"
                  >
                    {s.title}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>

        <OutcomeAnalysis />
      </div>

      <QuestionBank questions={questions} />
    </div>
  );
}
