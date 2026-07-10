"use client";

import { useRef, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Upload,
  ChevronDown,
  Archive,
  Sparkles,
  ExternalLink,
  Newspaper,
} from "lucide-react";
import { Card, PageHeader, Button, Input, Textarea, EmptyState } from "@/components/ui";
import { parseJsonStringArray } from "@/lib/types";
import type { Company, CompanyArchive } from "@/lib/types";

const emptyForm = {
  name: "",
  industry: "",
  analysis: "",
  talent_profile: "",
  notes: "",
  news: [""],
};

export default function CompaniesManager({ initialCompanies }: { initialCompanies: Company[] }) {
  const [companies, setCompanies] = useState(initialCompanies);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function set(key: "name" | "industry" | "analysis" | "talent_profile" | "notes", value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setNews(index: number, value: string) {
    setForm((f) => ({ ...f, news: f.news.map((n, i) => (i === index ? value : n)) }));
  }

  function addNewsField() {
    setForm((f) => ({ ...f, news: [...f.news, ""] }));
  }

  function removeNewsField(index: number) {
    setForm((f) => ({ ...f, news: f.news.filter((_, i) => i !== index) }));
  }

  function reset() {
    setForm(emptyForm);
    setOpen(false);
    setEditingId(null);
  }

  function startEdit(c: Company) {
    const news = parseJsonStringArray(c.news ?? "[]");
    setForm({
      name: c.name,
      industry: c.industry ?? "",
      analysis: c.analysis ?? "",
      talent_profile: c.talent_profile ?? "",
      notes: c.notes ?? "",
      news: news.length > 0 ? news : [""],
    });
    setEditingId(c.id);
    setOpen(true);
  }

  async function uploadInfoFile(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/companies/parse-file", { method: "POST", body: fd });
      if (!res.ok) throw new Error((await res.json()).error);
      const { text } = (await res.json()) as { text: string };
      setForm((f) => ({ ...f, analysis: f.analysis ? `${f.analysis}\n\n${text}` : text }));
    } catch (err) {
      alert((err as Error).message || "파일 처리에 실패했습니다.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setBusy(true);
    try {
      const url = editingId ? `/api/companies/${editingId}` : "/api/companies";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const saved = (await res.json()) as Company;
      setCompanies((prev) =>
        editingId ? prev.map((c) => (c.id === saved.id ? saved : c)) : [saved, ...prev]
      );
      reset();
    } catch (err) {
      alert((err as Error).message || "저장에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("이 기업 정보를 삭제할까요? 연결된 지원 내역도 함께 삭제됩니다.")) return;
    setCompanies((prev) => prev.filter((c) => c.id !== id));
    await fetch(`/api/companies/${id}`, { method: "DELETE" });
  }

  return (
    <div>
      <PageHeader
        title="기업 분석"
        description="기업/산업 분석과 인재상을 저장해두면 자소서 생성 시 자동으로 반영합니다."
        action={
          open ? (
            <Button variant="ghost" onClick={reset}>
              <X size={15} /> 취소
            </Button>
          ) : (
            <Button onClick={() => setOpen(true)}>
              <Plus size={15} /> 기업 추가
            </Button>
          )
        }
      />

      {open && (
        <Card className="p-5 mb-6">
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="기업명" value={form.name} onChange={(e) => set("name", e.target.value)} required />
              <Input
                placeholder="산업군 (예: IT/플랫폼, 제조, 금융)"
                value={form.industry}
                onChange={(e) => set("industry", e.target.value)}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-[#898781]">기업 정보 (직접 입력 또는 파일 업로드)</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt,.md"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadInfoFile(f);
                  }}
                />
                <Button
                  variant="ghost"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="!px-2 !py-1 text-xs"
                >
                  <Upload size={13} /> {uploading ? "파싱 중..." : "파일 업로드"}
                </Button>
              </div>
              <Textarea
                placeholder="기업 분석 (사업 영역, 최근 이슈, 산업 내 위치 등) — PDF/DOCX/TXT/MD 파일을 올리면 내용이 자동으로 채워집니다"
                rows={4}
                value={form.analysis}
                onChange={(e) => set("analysis", e.target.value)}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-[#898781]">기업 주요 뉴스 (개수 제한 없음)</label>
                <Button variant="ghost" onClick={addNewsField} className="!px-2 !py-1 text-xs">
                  <Plus size={13} /> 뉴스 추가
                </Button>
              </div>
              <div className="space-y-2">
                {form.news.map((n, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <Textarea
                      placeholder={`뉴스 ${i + 1} — 제목이나 요약을 붙여넣으세요 (선택)`}
                      rows={2}
                      value={n}
                      onChange={(e) => setNews(i, e.target.value)}
                    />
                    {form.news.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeNewsField(i)}
                        className="p-1.5 mt-1 rounded hover:bg-[#d03b3b]/10 text-[#d03b3b] shrink-0"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <Textarea
              placeholder="인재상 / 핵심가치"
              rows={3}
              value={form.talent_profile}
              onChange={(e) => set("talent_profile", e.target.value)}
            />
            <Textarea
              placeholder="메모 (선택)"
              rows={2}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={busy}>
                {editingId ? "수정 저장" : "저장"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {companies.length === 0 && !open ? (
        <EmptyState>등록된 기업이 없습니다. 위 버튼으로 추가해보세요.</EmptyState>
      ) : (
        <div className="space-y-3">
          {companies.map((c) => (
            <CompanyCard
              key={c.id}
              company={c}
              onEdit={() => startEdit(c)}
              onDelete={() => remove(c.id)}
              onPatch={(patch) =>
                setCompanies((prev) => prev.map((x) => (x.id === c.id ? { ...x, ...patch } : x)))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CompanyCard({
  company,
  onEdit,
  onDelete,
  onPatch,
}: {
  company: Company;
  onEdit: () => void;
  onDelete: () => void;
  onPatch: (patch: Partial<Company>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [archives, setArchives] = useState<CompanyArchive[] | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showArchiveForm, setShowArchiveForm] = useState(false);
  const [archiveForm, setArchiveForm] = useState({ title: "", url: "", content: "" });
  const [savingArchive, setSavingArchive] = useState(false);
  const [parsingFile, setParsingFile] = useState(false);
  const [newNews, setNewNews] = useState("");
  const [savingNews, setSavingNews] = useState(false);
  const archiveFileRef = useRef<HTMLInputElement>(null);

  const newsList = parseJsonStringArray(company.news ?? "[]");

  async function saveNews(nextNews: string[]) {
    setSavingNews(true);
    setError(null);
    try {
      const res = await fetch(`/api/companies/${company.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: company.name,
          industry: company.industry ?? "",
          analysis: company.analysis ?? "",
          talent_profile: company.talent_profile ?? "",
          notes: company.notes ?? "",
          news: nextNews,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      onPatch({ news: JSON.stringify(nextNews.map((n) => n.trim()).filter(Boolean)) });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingNews(false);
    }
  }

  async function addNews() {
    if (!newNews.trim()) return;
    await saveNews([...newsList, newNews.trim()]);
    setNewNews("");
  }

  async function toggleExpand() {
    const next = !expanded;
    setExpanded(next);
    if (next && archives === null) {
      const res = await fetch(`/api/companies/${company.id}/archives`);
      if (res.ok) setArchives((await res.json()) as CompanyArchive[]);
    }
  }

  async function analyze() {
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch(`/api/companies/${company.id}/analyze`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      onPatch({ ai_report: data.ai_report });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAnalyzing(false);
    }
  }

  async function addArchive(ev: React.FormEvent) {
    ev.preventDefault();
    if (!archiveForm.title.trim() || !archiveForm.content.trim()) return;
    setSavingArchive(true);
    setError(null);
    try {
      const res = await fetch(`/api/companies/${company.id}/archives`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(archiveForm),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const saved = (await res.json()) as CompanyArchive;
      setArchives((prev) => [saved, ...(prev ?? [])]);
      setArchiveForm({ title: "", url: "", content: "" });
      setShowArchiveForm(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingArchive(false);
    }
  }

  async function deleteArchive(id: string) {
    if (!confirm("이 아카이브 항목을 삭제할까요?")) return;
    setArchives((prev) => (prev ?? []).filter((a) => a.id !== id));
    await fetch(`/api/archives/${id}`, { method: "DELETE" });
  }

  const [fetchingUrl, setFetchingUrl] = useState(false);

  async function fetchFromUrl() {
    if (!archiveForm.url.trim()) {
      setError("먼저 출처 URL을 입력하세요.");
      return;
    }
    setFetchingUrl(true);
    setError(null);
    try {
      const res = await fetch("/api/fetch-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: archiveForm.url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setArchiveForm((f) => ({
        ...f,
        title: f.title || data.title,
        content: f.content ? `${f.content}\n\n${data.text}` : data.text,
      }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setFetchingUrl(false);
    }
  }

  async function parseArchiveFile(file: File) {
    setParsingFile(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/companies/parse-file", { method: "POST", body: fd });
      if (!res.ok) throw new Error((await res.json()).error);
      const { text } = (await res.json()) as { text: string };
      setArchiveForm((f) => ({
        ...f,
        title: f.title || file.name.replace(/\.[^.]+$/, ""),
        content: f.content ? `${f.content}\n\n${text}` : text,
      }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setParsingFile(false);
      if (archiveFileRef.current) archiveFileRef.current.value = "";
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <button onClick={toggleExpand} className="min-w-0 flex-1 text-left cursor-pointer">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-medium text-[#0b0b0b] dark:text-white">{company.name}</h3>
            {company.industry && <span className="text-xs text-[#898781]">{company.industry}</span>}
            <ChevronDown
              size={14}
              className={`text-[#898781] transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </div>
          {company.analysis && !expanded && (
            <p className="text-sm text-[#52514e] dark:text-[#c3c2b7] whitespace-pre-wrap line-clamp-2">
              {company.analysis}
            </p>
          )}
        </button>
        <div className="flex gap-1 shrink-0">
          <button
            onClick={onEdit}
            className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 text-[#52514e] dark:text-[#c3c2b7]"
          >
            <Pencil size={14} />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded hover:bg-[#d03b3b]/10 text-[#d03b3b]">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 border-t border-[rgba(11,11,11,0.10)] dark:border-[rgba(255,255,255,0.10)] pt-3 space-y-4">
          {error && <p className="text-xs text-[#d03b3b]">{error}</p>}

          {company.analysis && (
            <div>
              <p className="text-xs font-medium text-[#898781] mb-1">기업 정보</p>
              <p className="text-sm text-[#52514e] dark:text-[#c3c2b7] whitespace-pre-wrap">
                {company.analysis}
              </p>
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-[#898781] mb-1.5 inline-flex items-center gap-1">
              <Newspaper size={12} /> 주요 뉴스 ({newsList.length})
            </p>
            {newsList.length > 0 && (
              <ul className="space-y-1.5 mb-2">
                {newsList.map((n, i) => (
                  <li key={i} className="flex items-start justify-between gap-2 text-sm">
                    <span className="text-[#52514e] dark:text-[#c3c2b7] whitespace-pre-wrap min-w-0">
                      {n}
                    </span>
                    <button
                      onClick={() => saveNews(newsList.filter((_, idx) => idx !== i))}
                      disabled={savingNews}
                      className="p-1 rounded hover:bg-[#d03b3b]/10 text-[#d03b3b] shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-start gap-2">
              <Textarea
                placeholder="새 뉴스 제목/요약을 붙여넣고 추가를 누르세요"
                rows={2}
                value={newNews}
                onChange={(e) => setNewNews(e.target.value)}
              />
              <Button
                variant="secondary"
                onClick={addNews}
                disabled={savingNews || !newNews.trim()}
                className="!px-2.5 !py-1.5 text-xs shrink-0 mt-1"
              >
                <Plus size={13} /> 추가
              </Button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-medium text-[#898781]">AI 기업 분석 리포트</p>
              <Button variant="secondary" onClick={analyze} disabled={analyzing} className="!px-2.5 !py-1 text-xs">
                <Sparkles size={13} /> {analyzing ? "분석 중..." : company.ai_report ? "다시 분석" : "AI 분석"}
              </Button>
            </div>
            {company.ai_report ? (
              <pre className="whitespace-pre-wrap font-sans text-sm text-[#0b0b0b] dark:text-white leading-relaxed rounded-lg bg-black/[0.03] dark:bg-white/[0.04] p-3">
                {company.ai_report}
              </pre>
            ) : (
              <p className="text-xs text-[#898781]">
                등록된 정보·뉴스·아카이브를 종합해 사업 현황, 최근 이슈, 인재상 해석, 자소서 활용 포인트를 정리합니다.
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-medium text-[#898781] inline-flex items-center gap-1">
                <Archive size={12} /> 기사/자료 아카이브 {archives ? `(${archives.length})` : ""}
              </p>
              <Button
                variant="secondary"
                onClick={() => setShowArchiveForm((v) => !v)}
                className="!px-2.5 !py-1 text-xs"
              >
                {showArchiveForm ? <X size={13} /> : <Plus size={13} />} {showArchiveForm ? "취소" : "자료 추가"}
              </Button>
            </div>

            {showArchiveForm && (
              <form onSubmit={addArchive} className="space-y-2 mb-3 rounded-lg border border-[rgba(11,11,11,0.10)] dark:border-[rgba(255,255,255,0.10)] p-3">
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="제목 (기사 제목, 자료명)"
                    value={archiveForm.title}
                    onChange={(e) => setArchiveForm((f) => ({ ...f, title: e.target.value }))}
                    required
                  />
                  <div className="flex gap-1.5">
                    <Input
                      placeholder="출처 URL (선택)"
                      value={archiveForm.url}
                      onChange={(e) => setArchiveForm((f) => ({ ...f, url: e.target.value }))}
                    />
                    <Button
                      variant="ghost"
                      onClick={fetchFromUrl}
                      disabled={fetchingUrl || !archiveForm.url.trim()}
                      className="!px-2 !py-1 text-xs shrink-0"
                    >
                      {fetchingUrl ? "수집 중..." : "본문 수집"}
                    </Button>
                  </div>
                </div>
                <Textarea
                  placeholder="본문/내용을 붙여넣거나 파일을 업로드하세요"
                  rows={4}
                  value={archiveForm.content}
                  onChange={(e) => setArchiveForm((f) => ({ ...f, content: e.target.value }))}
                  required
                />
                <div className="flex items-center justify-between">
                  <input
                    ref={archiveFileRef}
                    type="file"
                    accept=".pdf,.docx,.txt,.md"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) parseArchiveFile(f);
                    }}
                  />
                  <Button
                    variant="ghost"
                    onClick={() => archiveFileRef.current?.click()}
                    disabled={parsingFile}
                    className="!px-2 !py-1 text-xs"
                  >
                    <Upload size={13} /> {parsingFile ? "파싱 중..." : "파일 업로드"}
                  </Button>
                  <Button type="submit" disabled={savingArchive} className="!px-3 !py-1.5 text-xs">
                    {savingArchive ? "저장 중..." : "아카이브 저장"}
                  </Button>
                </div>
              </form>
            )}

            {archives === null ? (
              <p className="text-xs text-[#898781]">불러오는 중...</p>
            ) : archives.length === 0 ? (
              <p className="text-xs text-[#898781]">
                아카이브한 자료가 없습니다. 기사, 채용공고, IR 자료 등을 저장해두면 생성·분석에 활용됩니다.
              </p>
            ) : (
              <ul className="space-y-2">
                {archives.map((a) => (
                  <li
                    key={a.id}
                    className="rounded-lg border border-[rgba(11,11,11,0.10)] dark:border-[rgba(255,255,255,0.10)] p-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm text-[#0b0b0b] dark:text-white font-medium flex items-center gap-1.5">
                          {a.title}
                          {a.url && (
                            <a
                              href={a.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[#2a78d6] dark:text-[#3987e5] shrink-0"
                            >
                              <ExternalLink size={12} />
                            </a>
                          )}
                        </p>
                        <p className="text-xs text-[#52514e] dark:text-[#c3c2b7] line-clamp-2 whitespace-pre-wrap mt-0.5">
                          {a.content}
                        </p>
                        <p className="text-[10px] text-[#898781] mt-1">{a.created_at}</p>
                      </div>
                      <button
                        onClick={() => deleteArchive(a.id)}
                        className="p-1 rounded hover:bg-[#d03b3b]/10 text-[#d03b3b] shrink-0"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
