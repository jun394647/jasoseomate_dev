"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { Card, PageHeader, Button, Input, Textarea, Select, EmptyState } from "@/components/ui";
import type { SampleEssay, EssayResult } from "@/lib/types";

const RESULT_LABELS: Record<EssayResult, string> = {
  합격: "합격",
  불합격: "불합격",
  unknown: "미상",
};

const emptyForm = {
  company_name: "",
  industry: "",
  job_role: "",
  question: "",
  content: "",
  result: "unknown" as EssayResult,
  memo: "",
};

export default function SamplesManager({ initialEssays }: { initialEssays: SampleEssay[] }) {
  const [essays, setEssays] = useState(initialEssays);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function reset() {
    setForm(emptyForm);
    setOpen(false);
    setEditingId(null);
  }

  function startEdit(e: SampleEssay) {
    setForm({
      company_name: e.company_name ?? "",
      industry: e.industry ?? "",
      job_role: e.job_role ?? "",
      question: e.question,
      content: e.content,
      result: e.result,
      memo: e.memo ?? "",
    });
    setEditingId(e.id);
    setOpen(true);
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setBusy(true);
    try {
      const url = editingId ? `/api/samples/${editingId}` : "/api/samples";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const saved = (await res.json()) as SampleEssay;
      setEssays((prev) => (editingId ? prev.map((e) => (e.id === saved.id ? saved : e)) : [saved, ...prev]));
      reset();
    } catch (err) {
      alert((err as Error).message || "저장에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("이 자소서를 삭제할까요?")) return;
    setEssays((prev) => prev.filter((e) => e.id !== id));
    await fetch(`/api/samples/${id}`, { method: "DELETE" });
  }

  return (
    <div>
      <PageHeader
        title="우수 자소서"
        description="합격했거나 참고할 만한 자소서를 저장해두면 새 자소서 생성 시 문체와 논리 전개를 참고합니다."
        action={
          open ? (
            <Button variant="ghost" onClick={reset}>
              <X size={15} /> 취소
            </Button>
          ) : (
            <Button onClick={() => setOpen(true)}>
              <Plus size={15} /> 자소서 추가
            </Button>
          )
        }
      />

      {open && (
        <Card className="p-5 mb-6">
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-4 gap-3">
              <Input
                placeholder="기업명"
                value={form.company_name}
                onChange={(e) => set("company_name", e.target.value)}
              />
              <Input
                placeholder="산업군"
                value={form.industry}
                onChange={(e) => set("industry", e.target.value)}
              />
              <Input
                placeholder="직무"
                value={form.job_role}
                onChange={(e) => set("job_role", e.target.value)}
              />
              <Select value={form.result} onChange={(e) => set("result", e.target.value as EssayResult)}>
                {Object.entries(RESULT_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </div>
            <Input
              placeholder="자소서 문항"
              value={form.question}
              onChange={(e) => set("question", e.target.value)}
              required
            />
            <Textarea
              placeholder="자소서 본문"
              rows={8}
              value={form.content}
              onChange={(e) => set("content", e.target.value)}
              required
            />
            <Input
              placeholder="메모 (선택)"
              value={form.memo}
              onChange={(e) => set("memo", e.target.value)}
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={busy}>
                {editingId ? "수정 저장" : "저장"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {essays.length === 0 && !open ? (
        <EmptyState>등록된 우수 자소서가 없습니다. 위 버튼으로 추가해보세요.</EmptyState>
      ) : (
        <div className="space-y-3">
          {essays.map((e) => (
            <Card key={e.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    {e.company_name && (
                      <span className="text-xs rounded-full px-2 py-0.5 bg-[#2a78d6]/10 text-[#2a78d6] dark:text-[#3987e5] font-medium">
                        {e.company_name}
                      </span>
                    )}
                    {e.job_role && <span className="text-xs text-[#898781]">{e.job_role}</span>}
                    {e.result !== "unknown" && (
                      <span
                        className="text-xs font-medium"
                        style={{ color: e.result === "합격" ? "#0ca30c" : "#d03b3b" }}
                      >
                        {e.result}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-medium text-[#0b0b0b] dark:text-white mb-1">{e.question}</h3>
                  <p className="text-sm text-[#52514e] dark:text-[#c3c2b7] whitespace-pre-wrap line-clamp-3">
                    {e.content}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => startEdit(e)}
                    className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 text-[#52514e] dark:text-[#c3c2b7]"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => remove(e.id)}
                    className="p-1.5 rounded hover:bg-[#d03b3b]/10 text-[#d03b3b]"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
