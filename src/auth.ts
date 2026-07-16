import { randomUUID } from "node:crypto";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { getDb } from "@/lib/db";
import type { UserRole } from "@/lib/types";

const SIGNUP_GRANT_TOKENS = 200;

interface AppJwtUser {
  id: string;
  role: UserRole;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile?.email) {
        const appUser = await upsertUser({
          googleId: account.providerAccountId,
          email: profile.email,
          name: profile.name ?? null,
          image: (profile as { picture?: string }).picture ?? null,
        });
        (token as typeof token & AppJwtUser).id = appUser.id;
        (token as typeof token & AppJwtUser).role = appUser.role;
      }
      return token;
    },
    async session({ session, token }) {
      const t = token as typeof token & Partial<AppJwtUser>;
      if (session.user && t.id) {
        (session.user as typeof session.user & AppJwtUser).id = t.id;
        (session.user as typeof session.user & AppJwtUser).role = t.role ?? "member";
      }
      return session;
    },
  },
});

async function upsertUser(input: {
  googleId: string;
  email: string;
  name: string | null;
  image: string | null;
}): Promise<{ id: string; role: UserRole }> {
  const db = await getDb();

  const byGoogleId = (await db
    .prepare(`SELECT id, role FROM users WHERE google_id = ?`)
    .get(input.googleId)) as { id: string; role: UserRole } | undefined;
  if (byGoogleId) {
    await db
      .prepare(
        `UPDATE users SET name = ?, image = ?, last_login_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
      )
      .run(input.name, input.image, byGoogleId.id);
    return byGoogleId;
  }

  const byEmail = (await db
    .prepare(`SELECT id, role FROM users WHERE email = ?`)
    .get(input.email)) as { id: string; role: UserRole } | undefined;
  if (byEmail) {
    // 마이그레이션 때 이메일만 채워둔 관리자 시드 행 — 첫 로그인 시 google_id를 붙인다.
    await db
      .prepare(
        `UPDATE users SET google_id = ?, name = ?, image = ?, last_login_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
      )
      .run(input.googleId, input.name, input.image, byEmail.id);
    return byEmail;
  }

  const id = randomUUID();
  await db
    .prepare(
      `INSERT INTO users (id, google_id, email, name, image, role, token_balance, last_login_at)
       VALUES (?, ?, ?, ?, ?, 'member', ?, datetime('now'))`
    )
    .run(id, input.googleId, input.email, input.name, input.image, SIGNUP_GRANT_TOKENS);
  await db
    .prepare(
      `INSERT INTO token_transactions (id, user_id, delta, reason, balance_after) VALUES (?, ?, ?, 'signup_grant', ?)`
    )
    .run(randomUUID(), id, SIGNUP_GRANT_TOKENS, SIGNUP_GRANT_TOKENS);

  return { id, role: "member" };
}
