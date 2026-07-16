import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/ui";
import type { ApplicationWithCompany, Company } from "@/lib/types";
import ApplicationsManager from "./ApplicationsManager";

export default async function ApplicationsPage() {
  const session = await getSession();
  if (!session) {
    return (
      <div>
        <PageHeader title="지원 관리" />
        <EmptyState>로그인이 필요합니다.</EmptyState>
      </div>
    );
  }

  const db = await getDb();
  const applications = (await db
    .prepare(
      `SELECT a.*, c.name AS company_name, c.industry AS industry
       FROM applications a JOIN companies c ON c.id = a.company_id
       WHERE a.user_id = ?
       ORDER BY a.updated_at DESC`
    )
    .all(session.id)) as ApplicationWithCompany[];
  const companies = (await db
    .prepare(`SELECT * FROM companies WHERE user_id = ? ORDER BY name ASC`)
    .all(session.id)) as Company[];

  return <ApplicationsManager initialApplications={applications} companies={companies} />;
}
