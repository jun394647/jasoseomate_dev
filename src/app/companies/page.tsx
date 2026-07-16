import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/ui";
import type { Company } from "@/lib/types";
import CompaniesManager from "./CompaniesManager";

export default async function CompaniesPage() {
  const session = await getSession();
  if (!session) {
    return (
      <div>
        <PageHeader title="기업 분석" />
        <EmptyState>로그인이 필요합니다.</EmptyState>
      </div>
    );
  }

  const db = await getDb();
  const companies = (await db
    .prepare(`SELECT * FROM companies WHERE user_id = ? ORDER BY updated_at DESC`)
    .all(session.id)) as Company[];

  return <CompaniesManager initialCompanies={companies} />;
}
