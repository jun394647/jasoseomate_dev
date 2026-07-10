import { getDb } from "@/lib/db";
import type { ApplicationWithCompany, Company } from "@/lib/types";
import ApplicationsManager from "./ApplicationsManager";

export default async function ApplicationsPage() {
  const db = await getDb();
  const applications = (await db
    .prepare(
      `SELECT a.*, c.name AS company_name, c.industry AS industry
       FROM applications a JOIN companies c ON c.id = a.company_id
       ORDER BY a.updated_at DESC`
    )
    .all()) as ApplicationWithCompany[];
  const companies = (await db.prepare(`SELECT * FROM companies ORDER BY name ASC`).all()) as Company[];

  return <ApplicationsManager initialApplications={applications} companies={companies} />;
}
