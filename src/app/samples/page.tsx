import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/ui";
import type { SampleEssay } from "@/lib/types";
import SamplesManager from "./SamplesManager";

export default async function SamplesPage() {
  const session = await getSession();
  if (!session) {
    return (
      <div>
        <PageHeader title="우수 자소서" />
        <EmptyState>로그인이 필요합니다.</EmptyState>
      </div>
    );
  }

  const db = await getDb();
  const essays = (await db
    .prepare(`SELECT * FROM sample_essays WHERE user_id = ? ORDER BY updated_at DESC`)
    .all(session.id)) as SampleEssay[];

  return <SamplesManager initialEssays={essays} />;
}
