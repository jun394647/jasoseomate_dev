"use client";

import { useRef, useState } from "react";
import { Download, Upload, HardDrive } from "lucide-react";
import { Card, Button } from "@/components/ui";

// 배포 환경은 디스크가 휘발성 — 전체 데이터를 .md로 내려받고 다시 올려 복원한다.
export default function BackupControls() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function restore(file: File) {
    if (!confirm("복원하면 현재 데이터가 백업 파일 내용으로 완전히 대체됩니다. 진행할까요?")) {
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/backup", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const c = data.counts as Record<string, number>;
      setMsg(
        `복원 완료 — 내 정보 ${c.profile_sources}건, 기업 ${c.companies}건, 지원서 ${c.applications}건, 문항 ${c.essay_questions}건`
      );
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <Card className="p-4 mt-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#0b0b0b] dark:text-white inline-flex items-center gap-1.5">
            <HardDrive size={15} /> 데이터 백업
          </p>
          <p className="text-xs text-[#898781] mt-0.5">
            전체 기록을 .md 파일 하나로 내려받고, 다시 올려서 복원할 수 있습니다. 서버가 초기화되기 전에
            꼭 백업하세요.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <a href="/api/backup" download>
            <Button variant="secondary">
              <Download size={15} /> 전체 백업 (.md)
            </Button>
          </a>
          <input
            ref={fileRef}
            type="file"
            accept=".md,.txt"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) restore(f);
            }}
          />
          <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={busy}>
            <Upload size={15} /> {busy ? "복원 중..." : "백업 복원"}
          </Button>
        </div>
      </div>
      {msg && <p className="text-xs text-[#898781] mt-2">{msg}</p>}
    </Card>
  );
}
