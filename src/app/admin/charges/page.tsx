import { getDb } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import type { ChargeRequest } from "@/lib/types";
import ChargeQueue from "./ChargeQueue";

interface ChargeRequestWithEmail extends ChargeRequest {
  email: string;
}

export default async function AdminChargesPage() {
  const db = await getDb();
  const requests = (await db
    .prepare(
      `SELECT cr.*, u.email FROM charge_requests cr JOIN users u ON u.id = cr.user_id ORDER BY cr.created_at DESC`
    )
    .all()) as ChargeRequestWithEmail[];

  return (
    <div>
      <PageHeader title="충전 승인" description="계좌이체 확인 후 토큰을 지급하거나 거절하세요." />
      <ChargeQueue initialRequests={requests} />
    </div>
  );
}
