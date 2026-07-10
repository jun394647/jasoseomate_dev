import { getDb } from "@/lib/db";
import type { Company } from "@/lib/types";
import CompaniesManager from "./CompaniesManager";

export default async function CompaniesPage() {
  const db = await getDb();
  const companies = (await db.prepare(`SELECT * FROM companies ORDER BY updated_at DESC`).all()) as Company[];

  return <CompaniesManager initialCompanies={companies} />;
}
