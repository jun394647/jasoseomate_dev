import { getDb } from "@/lib/db";
import type { ProfileSource } from "@/lib/types";
import ProfileManager from "./ProfileManager";

export default async function ProfilePage() {
  const db = await getDb();
  const sources = (await db
    .prepare(`SELECT * FROM profile_sources ORDER BY updated_at DESC`)
    .all()) as ProfileSource[];

  return <ProfileManager initialSources={sources} />;
}
