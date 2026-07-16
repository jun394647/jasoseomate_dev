"use client";

import { useState } from "react";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { Card, Button, Input } from "@/components/ui";
import type { User } from "@/lib/types";

export default function UsersTable({ initialUsers }: { initialUsers: User[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [adjustments, setAdjustments] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  async function adjustTokens(id: string) {
    const raw = adjustments[id];
    const delta = Number(raw);
    if (!raw || !Number.isFinite(delta) || delta === 0) {
      alert("조정할 토큰 수(+/-)를 입력하세요.");
      return;
    }
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "adjust_tokens", delta }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, token_balance: data.token_balance } : u))
      );
      setAdjustments((prev) => ({ ...prev, [id]: "" }));
    } catch (err) {
      alert((err as Error).message || "조정에 실패했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleRole(user: User) {
    const nextRole = user.role === "admin" ? "member" : "admin";
    if (!confirm(`${user.email}을(를) ${nextRole === "admin" ? "관리자로 승격" : "회원으로 강등"}할까요?`)) {
      return;
    }
    setBusyId(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_role", role: nextRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role: nextRole } : u)));
    } catch (err) {
      alert((err as Error).message || "역할 변경에 실패했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-2">
      {users.map((u) => (
        <Card key={u.id} className="p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-[#0b0b0b] dark:text-white truncate">{u.email}</p>
                <span
                  className={`text-[10px] rounded-full px-2 py-0.5 font-medium ${
                    u.role === "admin"
                      ? "bg-[#2a78d6]/10 text-[#2a78d6] dark:text-[#3987e5]"
                      : "bg-[#898781]/10 text-[#898781]"
                  }`}
                >
                  {u.role === "admin" ? "관리자" : "회원"}
                </span>
              </div>
              <p className="text-xs text-[#898781] mt-0.5">
                {u.role === "admin" ? "무제한" : `${u.token_balance.toLocaleString()} 토큰`} · 가입{" "}
                {u.created_at} · 최근 로그인 {u.last_login_at ?? "-"}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {u.role !== "admin" && (
                <>
                  <Input
                    type="number"
                    placeholder="+/-토큰"
                    className="!w-28"
                    value={adjustments[u.id] ?? ""}
                    onChange={(e) => setAdjustments((prev) => ({ ...prev, [u.id]: e.target.value }))}
                  />
                  <Button
                    variant="secondary"
                    disabled={busyId === u.id}
                    onClick={() => adjustTokens(u.id)}
                  >
                    적용
                  </Button>
                </>
              )}
              <Button variant="ghost" disabled={busyId === u.id} onClick={() => toggleRole(u)}>
                {u.role === "admin" ? <ShieldOff size={15} /> : <ShieldCheck size={15} />}
                {u.role === "admin" ? "회원으로" : "관리자로"}
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
