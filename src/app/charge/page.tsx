import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/ui";
import type { ChargeRequest } from "@/lib/types";
import ChargeForm from "./ChargeForm";

export default async function ChargePage() {
  const session = await getSession();
  if (!session) {
    return (
      <div>
        <PageHeader title="토큰 충전" />
        <EmptyState>로그인이 필요합니다.</EmptyState>
      </div>
    );
  }

  const db = await getDb();
  const user = (await db
    .prepare(`SELECT token_balance FROM users WHERE id = ?`)
    .get(session.id)) as { token_balance: number } | undefined;
  const requests = (await db
    .prepare(`SELECT * FROM charge_requests WHERE user_id = ? ORDER BY created_at DESC`)
    .all(session.id)) as ChargeRequest[];

  return (
    <ChargeForm
      bankName={process.env.TOKEN_CHARGE_BANK_NAME ?? ""}
      bankAccount={process.env.TOKEN_CHARGE_BANK_ACCOUNT ?? ""}
      bankHolder={process.env.TOKEN_CHARGE_BANK_HOLDER ?? ""}
      balance={user?.token_balance ?? 0}
      unlimited={session.role === "admin"}
      initialRequests={requests}
    />
  );
}
