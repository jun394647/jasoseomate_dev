"use client";

import { useState } from "react";
import { Copy, Check, Send } from "lucide-react";
import { Card, PageHeader, Button, Input, Textarea, EmptyState } from "@/components/ui";
import type { ChargeRequest, ChargeRequestStatus } from "@/lib/types";

const STATUS_LABELS: Record<ChargeRequestStatus, string> = {
  pending: "승인 대기",
  approved: "승인됨",
  rejected: "거절됨",
};

const STATUS_STYLES: Record<ChargeRequestStatus, string> = {
  pending: "bg-[#898781]/10 text-[#898781]",
  approved: "bg-[#2a78d6]/10 text-[#2a78d6] dark:text-[#3987e5]",
  rejected: "bg-[#d03b3b]/10 text-[#d03b3b]",
};

export default function ChargeForm({
  bankName,
  bankAccount,
  bankHolder,
  balance,
  unlimited,
  initialRequests,
}: {
  bankName: string;
  bankAccount: string;
  bankHolder: string;
  balance: number;
  unlimited: boolean;
  initialRequests: ChargeRequest[];
}) {
  const [copied, setCopied] = useState(false);
  const [requests, setRequests] = useState(initialRequests);
  const [amount, setAmount] = useState("");
  const [depositor, setDepositor] = useState("");
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);

  function copyAccount() {
    navigator.clipboard.writeText(bankAccount).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const claimed = Number(amount);
    if (!claimed || claimed <= 0) {
      alert("입금 금액을 입력하세요.");
      return;
    }
    if (!depositor.trim()) {
      alert("입금자명을 입력하세요.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/tokens/charge-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimed_amount_krw: claimed, depositor_name: depositor, memo }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const saved = (await res.json()) as ChargeRequest;
      setRequests((prev) => [saved, ...prev]);
      setAmount("");
      setDepositor("");
      setMemo("");
    } catch (err) {
      alert((err as Error).message || "신청에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="토큰 충전"
        description="계좌이체 후 아래 폼으로 신청하시면 관리자 확인 후 토큰이 지급됩니다."
      />

      <Card className="p-5 mb-6">
        <p className="text-sm font-medium text-[#0b0b0b] dark:text-white mb-3">현재 잔액</p>
        <p className="text-2xl font-semibold text-[#0b0b0b] dark:text-white">
          {unlimited ? "무제한 (관리자)" : `${balance.toLocaleString()} 토큰`}
        </p>
      </Card>

      <Card className="p-5 mb-6">
        <p className="text-sm font-medium text-[#0b0b0b] dark:text-white mb-3">입금 계좌</p>
        <div className="flex items-center gap-2 mb-2">
          <p className="text-sm text-[#52514e] dark:text-[#c3c2b7]">
            {bankName} {bankAccount} ({bankHolder})
          </p>
          <button
            onClick={copyAccount}
            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 text-[#898781]"
            aria-label="계좌번호 복사"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
        <p className="text-xs text-[#898781]">
          100토큰 ≈ 1,000원 (참고용 안내이며, 실제 지급 토큰은 관리자가 입금 확인 후 결정합니다)
        </p>
      </Card>

      <Card className="p-5 mb-6">
        <p className="text-sm font-medium text-[#0b0b0b] dark:text-white mb-3">충전 신청</p>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="number"
              min={1}
              placeholder="입금 금액 (원)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <Input
              placeholder="입금자명"
              value={depositor}
              onChange={(e) => setDepositor(e.target.value)}
              required
            />
          </div>
          <Textarea
            placeholder="메모 (선택)"
            rows={2}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={busy}>
              <Send size={15} /> {busy ? "신청 중..." : "충전 신청"}
            </Button>
          </div>
        </form>
      </Card>

      <p className="text-sm font-medium text-[#0b0b0b] dark:text-white mb-3">내 신청 내역</p>
      {requests.length === 0 ? (
        <EmptyState>신청 내역이 없습니다.</EmptyState>
      ) : (
        <div className="space-y-2">
          {requests.map((r) => (
            <Card key={r.id} className="p-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm text-[#0b0b0b] dark:text-white">
                    {r.claimed_amount_krw.toLocaleString()}원 · {r.depositor_name}
                  </p>
                  <p className="text-xs text-[#898781] mt-0.5">{r.created_at}</p>
                  {r.admin_note && (
                    <p className="text-xs text-[#898781] mt-1">관리자 메모: {r.admin_note}</p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[r.status]}`}
                >
                  {STATUS_LABELS[r.status]}
                  {r.status === "approved" && r.granted_tokens ? ` (+${r.granted_tokens})` : ""}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
