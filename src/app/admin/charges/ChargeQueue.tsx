"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { Card, Button, Input, EmptyState } from "@/components/ui";
import type { ChargeRequest, ChargeRequestStatus } from "@/lib/types";

interface ChargeRequestWithEmail extends ChargeRequest {
  email: string;
}

const STATUS_LABELS: Record<ChargeRequestStatus, string> = {
  pending: "승인 대기",
  approved: "승인됨",
  rejected: "거절됨",
};

export default function ChargeQueue({ initialRequests }: { initialRequests: ChargeRequestWithEmail[] }) {
  const [requests, setRequests] = useState(initialRequests);
  const [grantInputs, setGrantInputs] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<ChargeRequestStatus>("pending");

  async function approve(id: string) {
    const raw = grantInputs[id];
    const tokens = Number(raw);
    if (!raw || !Number.isFinite(tokens) || tokens <= 0) {
      alert("지급할 토큰 수를 입력하세요.");
      return;
    }
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/charges/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", granted_tokens: tokens }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: "approved", granted_tokens: tokens } : r))
      );
    } catch (err) {
      alert((err as Error).message || "승인에 실패했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    const note = window.prompt("거절 사유(선택):") ?? "";
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/charges/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", admin_note: note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: "rejected", admin_note: note } : r))
      );
    } catch (err) {
      alert((err as Error).message || "거절에 실패했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  const filtered = requests.filter((r) => r.status === filter);

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {(["pending", "approved", "rejected"] as ChargeRequestStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              filter === s
                ? "bg-[#2a78d6]/10 text-[#2a78d6] dark:text-[#3987e5]"
                : "text-[#898781] hover:bg-black/5 dark:hover:bg-white/5"
            }`}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState>해당 상태의 요청이 없습니다.</EmptyState>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#0b0b0b] dark:text-white">
                    {r.email} · {r.claimed_amount_krw.toLocaleString()}원
                  </p>
                  <p className="text-xs text-[#898781] mt-0.5">
                    입금자명: {r.depositor_name} · {r.created_at}
                    {r.memo ? ` · 메모: ${r.memo}` : ""}
                  </p>
                  {r.status !== "pending" && (
                    <p className="text-xs text-[#898781] mt-1">
                      {r.status === "approved" ? `지급 ${r.granted_tokens}토큰` : "거절"}
                      {r.admin_note ? ` · ${r.admin_note}` : ""}
                    </p>
                  )}
                </div>
                {r.status === "pending" && (
                  <div className="flex items-center gap-2 shrink-0">
                    <Input
                      type="number"
                      placeholder="지급 토큰"
                      className="!w-28"
                      value={grantInputs[r.id] ?? ""}
                      onChange={(e) => setGrantInputs((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    />
                    <Button disabled={busyId === r.id} onClick={() => approve(r.id)}>
                      <Check size={15} /> 승인
                    </Button>
                    <Button variant="danger" disabled={busyId === r.id} onClick={() => reject(r.id)}>
                      <X size={15} /> 거절
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
