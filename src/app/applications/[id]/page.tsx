import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/ui";
import type { ApplicationWithCompany, EssayQuestion, EssayVersion, ProfileSource } from "@/lib/types";
import ApplicationDetail from "./ApplicationDetail";

export default async function ApplicationDetailPage({
  params,
}: PageProps<"/applications/[id]">) {
  const session = await getSession();
  if (!session) {
    return (
      <div>
        <PageHeader title="지원 상세" />
        <EmptyState>로그인이 필요합니다.</EmptyState>
      </div>
    );
  }

  const { id } = await params;
  const db = await getDb();

  const application = (await db
    .prepare(
      `SELECT a.*, c.name AS company_name, c.industry AS industry
       FROM applications a JOIN companies c ON c.id = a.company_id WHERE a.id = ? AND a.user_id = ?`
    )
    .get(id, session.id)) as ApplicationWithCompany | undefined;

  if (!application) notFound();

  const questions = (await db
    .prepare(`SELECT * FROM essay_questions WHERE application_id = ? ORDER BY order_index ASC`)
    .all(id)) as EssayQuestion[];

  const versionsByQuestion: Record<string, EssayVersion[]> = {};
  if (questions.length > 0) {
    const placeholders = questions.map(() => "?").join(",");
    const versions = (await db
      .prepare(
        `SELECT * FROM essay_versions WHERE question_id IN (${placeholders}) ORDER BY created_at DESC`
      )
      .all(...questions.map((q) => q.id))) as EssayVersion[];
    for (const v of versions) {
      (versionsByQuestion[v.question_id] ??= []).push(v);
    }
  }

  const profileSources = (await db
    .prepare(
      `SELECT id, title, category, '' AS content, created_at, updated_at FROM profile_sources WHERE user_id = ? ORDER BY category, updated_at DESC`
    )
    .all(session.id)) as ProfileSource[];

  return (
    <ApplicationDetail
      application={application}
      initialQuestions={questions}
      versionsByQuestion={versionsByQuestion}
      profileSources={profileSources}
    />
  );
}
