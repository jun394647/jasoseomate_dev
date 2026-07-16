import { getDb } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import type { User } from "@/lib/types";
import UsersTable from "./UsersTable";

export default async function AdminUsersPage() {
  const db = await getDb();
  const users = (await db
    .prepare(`SELECT * FROM users ORDER BY created_at DESC`)
    .all()) as User[];

  return (
    <div>
      <PageHeader title="사용자 관리" description={`총 ${users.length}명`} />
      <UsersTable initialUsers={users} />
    </div>
  );
}
