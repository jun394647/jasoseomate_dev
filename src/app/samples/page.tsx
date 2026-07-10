import { getDb } from "@/lib/db";
import type { SampleEssay } from "@/lib/types";
import SamplesManager from "./SamplesManager";

export default async function SamplesPage() {
  const db = await getDb();
  const essays = (await db
    .prepare(`SELECT * FROM sample_essays ORDER BY updated_at DESC`)
    .all()) as SampleEssay[];

  return <SamplesManager initialEssays={essays} />;
}
