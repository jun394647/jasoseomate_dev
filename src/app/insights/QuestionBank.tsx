"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Card, Input, EmptyState } from "@/components/ui";
import { APPLICATION_STATUS_LABELS } from "@/lib/types";
import type { ApplicationStatus } from "@/lib/types";

interface BankQuestion {
  id: string;
  question_text: string;
  max_length: number | null;
  company_name: string;
  job_role: string;
  status: string;
}

export default function QuestionBank({ questions }: { questions: BankQuestion[] }) {
  const [filter, setFilter] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = questions.filter(
    (q) =>
      q.question_text.toLowerCase().includes(filter.toLowerCase()) ||
      q.company_name.toLowerCase().includes(filter.toLowerCase())
  );

  async function copy(q: BankQuestion) {
    await navigator.clipboard.writeText(q.question_text);
    setCopiedId(q.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-sm font-medium text-[#0b0b0b] dark:text-white">
          문항 은행 ({questions.length})
        </h2>
        <Input
          placeholder="문항/기업 검색"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="!w-56"
        />
      </div>
      {filtered.length === 0 ? (
        <EmptyState>등록된 문항이 없습니다.</EmptyState>
      ) : (
        <ul className="space-y-2">
          {filtered.map((q) => (
            <li
              key={q.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-[rgba(11,11,11,0.10)] dark:border-[rgba(255,255,255,0.10)] p-3"
            >
              <div className="min-w-0">
                <p className="text-sm text-[#0b0b0b] dark:text-white">{q.question_text}</p>
                <p className="text-xs text-[#898781] mt-1">
                  {q.company_name} · {q.job_role} ·{" "}
                  {APPLICATION_STATUS_LABELS[q.status as ApplicationStatus] ?? q.status}
                  {q.max_length ? ` · ${q.max_length}자` : ""}
                </p>
              </div>
              <button
                onClick={() => copy(q)}
                className="shrink-0 p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 text-[#52514e] dark:text-[#c3c2b7]"
                title="문항 복사"
              >
                {copiedId === q.id ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
