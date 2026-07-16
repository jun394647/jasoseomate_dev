import { getDb } from "@/lib/db";
import type { ProfileSource } from "@/lib/types";
import ProfileManager from "./ProfileManager";
import { getSession } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/ui";

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) {
    return (
      <div>
        <PageHeader title="내 정보" description="정보/이력/경력/경험/기타로 나누어 등록하면 자소서 생성 시 자동으로 참고합니다." />
        <EmptyState>로그인이 필요합니다.</EmptyState>
      </div>
    );
  }

  const db = await getDb();
  const sources = (await db
    .prepare(`SELECT * FROM profile_sources WHERE user_id = ? ORDER BY updated_at DESC`)
    .all(session.id)) as ProfileSource[];

  return <ProfileManager initialSources={sources} />;
}
