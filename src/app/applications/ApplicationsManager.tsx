"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, X, Trash2, BookOpen } from "lucide-react";
import { Card, PageHeader, Button, Input, Select, EmptyState, StatusBadge } from "@/components/ui";
import type { ApplicationWithCompany, ApplicationStatus, Company } from "@/lib/types";
import { APPLICATION_STATUS_LABELS } from "@/lib/types";
import { useNotionUnlocked } from "@/components/useNotionUnlocked";

const emptyForm = { company_id: "", job_role: "", status: "preparing" as ApplicationStatus, deadline: "" };

export default function ApplicationsManager({
  initialApplications,
  companies,
}: {
  initialApplications: ApplicationWithCompany[];
  companies: Company[];
}) {
  const [applications, setApplications] = useState(initialApplications);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const notionUnlocked = useNotionUnlocked();

  async function syncNotion() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/notion/sync-applications", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSyncMsg(`노션 동기화 완료 — 생성 ${data.created}건, 갱신 ${data.updated}건`);
    } catch (err) {
      setSyncMsg((err as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company_id) return;
    setBusy(true);
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const saved = (await res.json()) as ApplicationWithCompany;
      setApplications((prev) => [saved, ...prev]);
      setForm(emptyForm);
      setOpen(false);
    } catch (err) {
      alert((err as Error).message || "저장에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("이 지원 내역을 삭제할까요?")) return;
    setApplications((prev) => prev.filter((a) => a.id !== id));
    await fetch(`/api/applications/${id}`, { method: "DELETE" });
  }

  return (
    <div>
      <PageHeader
        title="지원 관리"
        description="기업별 지원 현황을 관리하고 문항별 자소서를 작성하세요."
        action={
          open ? (
            <Button variant="ghost" onClick={() => setOpen(false)}>
              <X size={15} /> 취소
            </Button>
          ) : (
            <>
              {notionUnlocked && (
                <Button variant="secondary" onClick={syncNotion} disabled={syncing || applications.length === 0}>
                  <BookOpen size={15} /> {syncing ? "동기화 중..." : "노션 동기화"}
                </Button>
              )}
              <Button onClick={() => setOpen(true)} disabled={companies.length === 0}>
                <Plus size={15} /> 지원 추가
              </Button>
            </>
          )
        }
      />

      {syncMsg && <p className="text-xs text-[#898781] mb-4 -mt-2">{syncMsg}</p>}

      {companies.length === 0 && (
        <EmptyState>
          먼저 <Link href="/companies" className="text-[#2a78d6] underline">기업 분석</Link> 페이지에서 지원할
          기업을 등록해주세요.
        </EmptyState>
      )}

      {open && (
        <Card className="p-5 mb-6">
          <form onSubmit={submit} className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
            <div className="col-span-2 md:col-span-1">
              <label className="text-xs text-[#898781] mb-1 block">기업</label>
              <Select value={form.company_id} onChange={(e) => set("company_id", e.target.value)} required>
                <option value="">선택</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-xs text-[#898781] mb-1 block">직무</label>
              <Input value={form.job_role} onChange={(e) => set("job_role", e.target.value)} required />
            </div>
            <div>
              <label className="text-xs text-[#898781] mb-1 block">상태</label>
              <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
                {Object.entries(APPLICATION_STATUS_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-xs text-[#898781] mb-1 block">마감일</label>
              <Input type="date" value={form.deadline} onChange={(e) => set("deadline", e.target.value)} />
            </div>
            <div className="col-span-2 md:col-span-4 flex justify-end">
              <Button type="submit" disabled={busy}>
                추가
              </Button>
            </div>
          </form>
        </Card>
      )}

      {applications.length === 0 && !open ? (
        <EmptyState>등록된 지원이 없습니다.</EmptyState>
      ) : (
        <div className="space-y-3">
          {applications.map((a) => (
            <Card key={a.id} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <Link href={`/applications/${a.id}`} className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-medium text-[#0b0b0b] dark:text-white">{a.company_name}</h3>
                    <span className="text-xs text-[#898781]">{a.job_role}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={a.status} />
                    {a.deadline && <span className="text-xs text-[#898781]">마감 {a.deadline}</span>}
                  </div>
                </Link>
                <button onClick={() => remove(a.id)} className="p-1.5 rounded hover:bg-[#d03b3b]/10 text-[#d03b3b] shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
