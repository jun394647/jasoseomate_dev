"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Card, Button } from "@/components/ui";

export default function OutcomeAnalysis() {
  const [report, setReport] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/insights/outcomes", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setReport(data.report);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-[#0b0b0b] dark:text-white">합불 회고 분석</h2>
        <Button variant="secondary" onClick={analyze} disabled={busy} className="!px-2.5 !py-1 text-xs">
          <Sparkles size={13} /> {busy ? "분석 중..." : report ? "다시 분석" : "AI 분석"}
        </Button>
      </div>
      {error && <p className="text-xs text-[#d03b3b] mb-2">{error}</p>}
      {report ? (
        <pre className="whitespace-pre-wrap font-sans text-sm text-[#0b0b0b] dark:text-white leading-relaxed">
          {report}
        </pre>
      ) : (
        <p className="text-xs text-[#898781]">
          결과(서류합격/면접합격/불합격)가 기록된 지원서들의 답안을 비교해 합격 답안의 공통점과 불합격
          답안의 약점을 분석합니다. 지원서 상태를 먼저 업데이트하세요.
        </p>
      )}
    </Card>
  );
}
