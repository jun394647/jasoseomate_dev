"use client";

import { useState } from "react";
import { Plus, Upload, Pencil, Trash2, X, BookOpen, ExternalLink, RefreshCw } from "lucide-react";
import { Card, PageHeader, Button, Input, Textarea, Select, EmptyState } from "@/components/ui";
import type { ProfileSource, ProfileCategory } from "@/lib/types";
import { PROFILE_CATEGORY_LABELS } from "@/lib/types";
import {
  type ExperienceFramework,
  FRAMEWORK_LABELS,
  fieldsForFramework,
  composeStructuredContent,
  parseStructuredContent,
} from "@/lib/profileTemplates";

import { useNotionUnlocked } from "@/components/useNotionUnlocked";

const CATEGORIES = Object.keys(PROFILE_CATEGORY_LABELS) as ProfileCategory[];
const FRAMEWORKS = Object.keys(FRAMEWORK_LABELS) as ExperienceFramework[];

interface NotionPageSummary {
  id: string;
  title: string;
  url: string;
  last_edited: string;
}

export default function ProfileManager({ initialSources }: { initialSources: ProfileSource[] }) {
  const [sources, setSources] = useState(initialSources);
  const [mode, setMode] = useState<"none" | "text" | "upload" | "notion">("none");
  const notionUnlocked = useNotionUnlocked();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ProfileCategory>("experience");
  const [content, setContent] = useState("");
  const [framework, setFramework] = useState<ExperienceFramework>("free");
  const [structuredValues, setStructuredValues] = useState<Record<string, string>>({});
  const [file, setFile] = useState<File | null>(null);

  const [notionPages, setNotionPages] = useState<NotionPageSummary[] | null>(null);
  const [notionError, setNotionError] = useState<string | null>(null);
  const [notionFilter, setNotionFilter] = useState("");
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  async function openNotionMode() {
    setMode("notion");
    setNotionError(null);
    setSelectedPages([]);
    setNotionFilter("");
    setNotionPages(null);
    try {
      const res = await fetch("/api/notion/pages");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (!data.configured) {
        throw new Error(
          "노션 연동이 설정되지 않았습니다. .env.local에 NOTION_API_KEY를 설정하고 서버를 재시작하세요."
        );
      }
      setNotionPages(data.pages as NotionPageSummary[]);
    } catch (err) {
      setNotionError((err as Error).message);
      setNotionPages([]);
    }
  }

  async function importFromNotion() {
    if (selectedPages.length === 0) return;
    setImporting(true);
    setNotionError(null);
    try {
      const res = await fetch("/api/profile/import-notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page_ids: selectedPages, category }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSources((prev) => [...(data.created as ProfileSource[]), ...prev]);
      if (data.failed?.length > 0) {
        setNotionError(
          `${data.created.length}개 가져옴, ${data.failed.length}개 실패: ${data.failed[0].error}`
        );
        setSelectedPages([]);
      } else {
        resetForm();
      }
    } catch (err) {
      setNotionError((err as Error).message);
    } finally {
      setImporting(false);
    }
  }

  function resetForm() {
    setTitle("");
    setCategory("experience");
    setContent("");
    setFramework("free");
    setStructuredValues({});
    setFile(null);
    setMode("none");
    setEditingId(null);
  }

  function startEdit(s: ProfileSource) {
    setEditingId(s.id);
    setTitle(s.title);
    setCategory(s.category);
    setMode("text");

    const parsed = s.category === "experience" ? parseStructuredContent(s.content) : null;
    if (parsed) {
      setFramework(parsed.framework);
      setStructuredValues(parsed.values);
      setContent("");
    } else {
      setFramework("free");
      setStructuredValues({});
      setContent(s.content);
    }
  }

  const isStructured = category === "experience" && framework !== "free";
  const finalContent = isStructured ? composeStructuredContent(framework, structuredValues) : content;

  async function submitText(e: React.FormEvent) {
    e.preventDefault();
    if (!finalContent.trim()) {
      alert("내용을 입력해주세요.");
      return;
    }
    setBusy(true);
    try {
      const url = editingId ? `/api/profile/${editingId}` : "/api/profile";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, category, content: finalContent }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const saved = (await res.json()) as ProfileSource;
      setSources((prev) =>
        editingId ? prev.map((s) => (s.id === saved.id ? saved : s)) : [saved, ...prev]
      );
      resetForm();
    } catch (err) {
      alert((err as Error).message || "저장에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function submitUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("title", title);
      form.set("category", category);
      const res = await fetch("/api/profile/upload", { method: "POST", body: form });
      if (!res.ok) throw new Error((await res.json()).error);
      const saved = (await res.json()) as ProfileSource;
      setSources((prev) => [saved, ...prev]);
      resetForm();
    } catch (err) {
      alert((err as Error).message || "업로드에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("이 자료를 삭제할까요?")) return;
    setSources((prev) => prev.filter((s) => s.id !== id));
    await fetch(`/api/profile/${id}`, { method: "DELETE" });
  }

  return (
    <div>
      <PageHeader
        title="내 정보"
        description="정보/이력/경력/경험/기타로 나누어 등록하면 자소서 생성 시 자동으로 참고합니다. 경험 항목은 STAR 기법이나 3C4P 분석으로 구조화해서 작성할 수 있습니다."
        action={
          mode === "none" ? (
            <>
              {notionUnlocked && (
                <Button variant="secondary" onClick={openNotionMode}>
                  <BookOpen size={15} /> 노션 가져오기
                </Button>
              )}
              <Button variant="secondary" onClick={() => setMode("upload")}>
                <Upload size={15} /> 파일 업로드
              </Button>
              <Button onClick={() => setMode("text")}>
                <Plus size={15} /> 직접 입력
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={resetForm}>
              <X size={15} /> 취소
            </Button>
          )
        }
      />

      {mode === "text" && (
        <Card className="p-5 mb-6">
          <form onSubmit={submitText} className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <Input
                placeholder="제목 (예: 학생회 활동 경험)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="col-span-2"
              />
              <Select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value as ProfileCategory);
                  setFramework("free");
                  setStructuredValues({});
                }}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {PROFILE_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </Select>
            </div>

            {category === "experience" && (
              <Select value={framework} onChange={(e) => setFramework(e.target.value as ExperienceFramework)}>
                {FRAMEWORKS.map((fw) => (
                  <option key={fw} value={fw}>
                    {FRAMEWORK_LABELS[fw]}
                  </option>
                ))}
              </Select>
            )}

            {isStructured ? (
              <div className="space-y-3">
                {fieldsForFramework(framework).map((f) => (
                  <div key={f.key}>
                    <label className="text-xs font-medium text-[#52514e] dark:text-[#c3c2b7] block mb-1">
                      {f.label}
                    </label>
                    <Textarea
                      placeholder={f.placeholder}
                      rows={3}
                      value={structuredValues[f.key] ?? ""}
                      onChange={(e) =>
                        setStructuredValues((prev) => ({ ...prev, [f.key]: e.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>
            ) : (
              <Textarea
                placeholder="경험/경력/이력 내용을 구체적으로 작성하세요. (상황, 역할, 행동, 성과 위주)"
                rows={6}
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            )}

            <div className="flex justify-end">
              <Button type="submit" disabled={busy}>
                {editingId ? "수정 저장" : "저장"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {mode === "notion" && (
        <Card className="p-5 mb-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-[#0b0b0b] dark:text-white">
                노션 페이지를 선택해 경험/이력으로 가져오기
              </p>
              <Button variant="ghost" onClick={openNotionMode} className="!px-2 !py-1 text-xs">
                <RefreshCw size={13} /> 새로고침
              </Button>
            </div>

            {notionError && <p className="text-xs text-[#d03b3b]">{notionError}</p>}

            {notionPages === null ? (
              <p className="text-sm text-[#898781]">노션 페이지 목록을 불러오는 중...</p>
            ) : notionPages.length === 0 ? (
              !notionError && (
                <p className="text-sm text-[#898781]">
                  가져올 수 있는 페이지가 없습니다. Integration이 연결된 페이지 하위에 문서를 만들어 보세요.
                </p>
              )
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <Input
                    placeholder="페이지 제목 검색"
                    value={notionFilter}
                    onChange={(e) => setNotionFilter(e.target.value)}
                    className="col-span-2"
                  />
                  <Select value={category} onChange={(e) => setCategory(e.target.value as ProfileCategory)}>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {PROFILE_CATEGORY_LABELS[c]}로 저장
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="max-h-72 overflow-y-auto space-y-1.5 border border-[rgba(11,11,11,0.10)] dark:border-[rgba(255,255,255,0.10)] rounded-lg p-2">
                  {notionPages
                    .filter((p) => p.title.toLowerCase().includes(notionFilter.toLowerCase()))
                    .map((p) => {
                      const checked = selectedPages.includes(p.id);
                      return (
                        <label
                          key={p.id}
                          className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 cursor-pointer text-sm transition-colors ${
                            checked
                              ? "bg-[#2a78d6]/10"
                              : "hover:bg-black/5 dark:hover:bg-white/5"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setSelectedPages((prev) =>
                                checked ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                              )
                            }
                            className="accent-[#2a78d6]"
                          />
                          <span className="text-[#0b0b0b] dark:text-white truncate flex-1">{p.title}</span>
                          <span className="text-[10px] text-[#898781] shrink-0">
                            {new Date(p.last_edited).toLocaleDateString("ko-KR")}
                          </span>
                          <a
                            href={p.url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[#2a78d6] dark:text-[#3987e5] shrink-0"
                          >
                            <ExternalLink size={12} />
                          </a>
                        </label>
                      );
                    })}
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-xs text-[#898781]">
                    {selectedPages.length}개 선택됨 · 페이지 본문이 텍스트로 변환되어 저장됩니다
                  </p>
                  <Button onClick={importFromNotion} disabled={importing || selectedPages.length === 0}>
                    <BookOpen size={15} /> {importing ? "가져오는 중..." : "선택한 페이지 가져오기"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </Card>
      )}

      {mode === "upload" && (
        <Card className="p-5 mb-6">
          <form onSubmit={submitUpload} className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <Input
                placeholder="제목 (비워두면 파일명 사용)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="col-span-2"
              />
              <Select value={category} onChange={(e) => setCategory(e.target.value as ProfileCategory)}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {PROFILE_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </Select>
            </div>
            <input
              type="file"
              accept=".pdf,.docx,.txt,.md"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required
              className="text-sm text-[#52514e] dark:text-[#c3c2b7]"
            />
            <p className="text-xs text-[#898781]">PDF, DOCX, TXT, MD 파일을 지원합니다.</p>
            <div className="flex justify-end">
              <Button type="submit" disabled={busy || !file}>
                업로드 및 저장
              </Button>
            </div>
          </form>
        </Card>
      )}

      {sources.length === 0 && mode === "none" ? (
        <EmptyState>등록된 정보가 없습니다. 위 버튼으로 추가해보세요.</EmptyState>
      ) : (
        <div className="space-y-3">
          {sources.map((s) => (
            <Card key={s.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs rounded-full px-2 py-0.5 bg-[#2a78d6]/10 text-[#2a78d6] dark:text-[#3987e5] font-medium">
                      {PROFILE_CATEGORY_LABELS[s.category]}
                    </span>
                    <h3 className="text-sm font-medium text-[#0b0b0b] dark:text-white truncate">{s.title}</h3>
                  </div>
                  <p className="text-sm text-[#52514e] dark:text-[#c3c2b7] whitespace-pre-wrap line-clamp-3">
                    {s.content}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => startEdit(s)}
                    className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 text-[#52514e] dark:text-[#c3c2b7]"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => remove(s.id)}
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
