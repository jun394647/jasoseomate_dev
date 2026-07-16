import { randomUUID } from "node:crypto";
import { getDb } from "./db";
import type { UserRole } from "./types";

export const TOKEN_COSTS = {
  essay_generate: 50,
  essay_ab: 100,
  essay_rewrite: 50,
  essay_review: 50,
  interview_questions: 50,
  interview_practice: 50,
  self_intro: 50,
  company_report: 50,
  insights_outcomes: 50,
} as const;

export type TokenReason = keyof typeof TOKEN_COSTS;

export class InsufficientTokensError extends Error {
  constructor(balance: number, cost: number) {
    super(`토큰이 부족합니다. 현재 잔액: ${balance}, 필요: ${cost}`);
  }
}

// 관리자는 무제한 — DB 차감 없이 바로 통과시킨다.
export async function chargeTokens(
  userId: string,
  role: UserRole,
  reason: TokenReason,
  cost: number
): Promise<{ unlimited: true } | { unlimited: false; balance: number }> {
  if (role === "admin") return { unlimited: true };

  const db = await getDb();
  const result = await db
    .prepare(`UPDATE users SET token_balance = token_balance - ?, updated_at = datetime('now') WHERE id = ? AND token_balance >= ?`)
    .run(cost, userId, cost);

  if (result.changes === 0) {
    const row = (await db.prepare(`SELECT token_balance FROM users WHERE id = ?`).get(userId)) as
      | { token_balance: number }
      | undefined;
    throw new InsufficientTokensError(row?.token_balance ?? 0, cost);
  }

  const row = (await db.prepare(`SELECT token_balance FROM users WHERE id = ?`).get(userId)) as {
    token_balance: number;
  };
  await db
    .prepare(
      `INSERT INTO token_transactions (id, user_id, delta, reason, balance_after) VALUES (?, ?, ?, ?, ?)`
    )
    .run(randomUUID(), userId, -cost, reason, row.token_balance);

  return { unlimited: false, balance: row.token_balance };
}

export async function refundTokens(userId: string, reason: TokenReason, cost: number): Promise<void> {
  const db = await getDb();
  await db
    .prepare(`UPDATE users SET token_balance = token_balance + ?, updated_at = datetime('now') WHERE id = ?`)
    .run(cost, userId);
  const row = (await db.prepare(`SELECT token_balance FROM users WHERE id = ?`).get(userId)) as {
    token_balance: number;
  };
  await db
    .prepare(
      `INSERT INTO token_transactions (id, user_id, delta, reason, balance_after) VALUES (?, ?, ?, ?, ?)`
    )
    .run(randomUUID(), userId, cost, `refund:${reason}`, row.token_balance);
}

export async function withTokenCharge<T>(
  userId: string,
  role: UserRole,
  reason: TokenReason,
  fn: () => Promise<T>
): Promise<T> {
  const cost = TOKEN_COSTS[reason];
  await chargeTokens(userId, role, reason, cost);
  try {
    return await fn();
  } catch (err) {
    await refundTokens(userId, reason, cost);
    throw err;
  }
}
