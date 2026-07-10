import { getDb } from "@/lib/db";
import { Card, PageHeader, EmptyState } from "@/components/ui";
import StatusDistribution from "@/components/StatusDistribution";
import BackupControls from "@/components/BackupControls";
import type { ApplicationStatus } from "@/lib/types";
import Link from "next/link";
import { UserRound, BookMarked, Building2, FolderKanban } from "lucide-react";

export default async function DashboardPage() {
  const db = await getDb();

  const profileCount = ((await db.prepare(`SELECT COUNT(*) AS c FROM profile_sources`).get()) as { c: number }).c;
  const sampleCount = ((await db.prepare(`SELECT COUNT(*) AS c FROM sample_essays`).get()) as { c: number }).c;
  const companyCount = ((await db.prepare(`SELECT COUNT(*) AS c FROM companies`).get()) as { c: number }).c;

  const statusRows = (await db
    .prepare(`SELECT status, COUNT(*) AS c FROM applications GROUP BY status`)
    .all()) as { status: ApplicationStatus; c: number }[];
  const statusCounts = Object.fromEntries(statusRows.map((r) => [r.status, r.c])) as Partial<
    Record<ApplicationStatus, number>
  >;
  const activeCount = statusRows
    .filter((r) => !["passed_interview", "rejected"].includes(r.status))
    .reduce((sum, r) => sum + r.c, 0);

  const upcoming = (await db
    .prepare(
      `SELECT a.id, a.deadline, a.job_role, c.name AS company_name,
              (SELECT COUNT(*) FROM essay_questions q WHERE q.application_id = a.id) AS total_questions,
              (SELECT COUNT(*) FROM essay_questions q WHERE q.application_id = a.id AND TRIM(q.content) != '') AS answered_questions
       FROM applications a JOIN companies c ON c.id = a.company_id
       WHERE a.deadline IS NOT NULL AND a.status NOT IN ('rejected', 'passed_interview')
       ORDER BY a.deadline ASC LIMIT 5`
    )
    .all()) as {
    id: string;
    deadline: string;
    job_role: string;
    company_name: string;
    total_questions: number;
    answered_questions: number;
  }[];

  const recentVersions = (await db
    .prepare(
      `SELECT v.created_at, v.source, q.question_text, a.id AS application_id, c.name AS company_name
       FROM essay_versions v
       JOIN essay_questions q ON q.id = v.question_id
       JOIN applications a ON a.id = q.application_id
       JOIN companies c ON c.id = a.company_id
       ORDER BY v.created_at DESC LIMIT 6`
    )
    .all()) as {
    created_at: string;
    source: string;
    question_text: string;
    application_id: string;
    company_name: string;
  }[];

  function dday(deadline: string): { label: string; urgent: boolean } {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(`${deadline}T00:00:00`);
    const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000);
    if (diff < 0) return { label: `D+${-diff}`, urgent: true };
    if (diff === 0) return { label: "D-DAY", urgent: true };
    return { label: `D-${diff}`, urgent: diff <= 3 };
  }

  const stats = [
    { label: "진행중인 지원", value: activeCount, icon: FolderKanban, href: "/applications" },
    { label: "등록된 경험/경력", value: profileCount, icon: UserRound, href: "/profile" },
    { label: "우수 자소서", value: sampleCount, icon: BookMarked, href: "/samples" },
    { label: "등록된 기업", value: companyCount, icon: Building2, href: "/companies" },
  ];

  return (
    <div>
      <PageHeader title="대시보드" description="자소서 작성 현황을 한눈에 확인하세요." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {stats.map(({ label, value, icon: Icon, href }) => (
          <Link key={label} href={href}>
            <Card className="p-4 hover:border-[#2a78d6]/40 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#898781]">{label}</span>
                <Icon size={15} className="text-[#2a78d6] dark:text-[#3987e5]" />
              </div>
              <p className="text-2xl font-semibold mt-2 text-[#0b0b0b] dark:text-white">{value}</p>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="p-5 mb-6">
        <h2 className="text-sm font-medium mb-4 text-[#0b0b0b] dark:text-white">지원 현황 분포</h2>
        <StatusDistribution counts={statusCounts} />
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5">
          <h2 className="text-sm font-medium mb-3 text-[#0b0b0b] dark:text-white">마감 임박</h2>
          {upcoming.length === 0 ? (
            <EmptyState>등록된 마감일이 없습니다.</EmptyState>
          ) : (
            <ul className="space-y-2.5">
              {upcoming.map((u) => {
                const d = dday(u.deadline);
                return (
                  <li key={u.id}>
                    <Link
                      href={`/applications/${u.id}`}
                      className="flex items-center justify-between gap-2 text-sm hover:underline"
                    >
                      <span className="text-[#0b0b0b] dark:text-white truncate">
                        {u.company_name} · {u.job_role}
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        {u.total_questions > 0 && (
                          <span className="text-[10px] text-[#898781]">
                            {u.answered_questions}/{u.total_questions} 문항
                          </span>
                        )}
                        <span className="text-[#898781] text-xs">{u.deadline}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            d.urgent
                              ? "bg-[#d03b3b]/10 text-[#d03b3b]"
                              : "bg-[#2a78d6]/10 text-[#2a78d6] dark:text-[#3987e5]"
                          }`}
                        >
                          {d.label}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-medium mb-3 text-[#0b0b0b] dark:text-white">최근 작성 활동</h2>
          {recentVersions.length === 0 ? (
            <EmptyState>아직 작성한 문항이 없습니다.</EmptyState>
          ) : (
            <ul className="space-y-2.5">
              {recentVersions.map((v, i) => (
                <li key={i}>
                  <Link href={`/applications/${v.application_id}`} className="block text-sm hover:underline">
                    <p className="text-[#0b0b0b] dark:text-white truncate">
                      {v.company_name} · {v.question_text}
                    </p>
                    <p className="text-xs text-[#898781]">
                      {v.source === "ai" ? "AI 생성" : "직접 수정"} · {v.created_at}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <BackupControls />
    </div>
  );
}
