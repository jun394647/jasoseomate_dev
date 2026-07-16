"use client";

import { useRef, useState } from "react";
import { Plus, Upload, X, Download, FileUp } from "lucide-react";
import { Card, PageHeader, Button, Input, Textarea, Select, EmptyState } from "@/components/ui";
import type { ProfileSource, ProfileCategory } from "@/lib/types";
import { PROFILE_CATEGORY_LABELS } from "@/lib/types";
import {
  type ExperienceFramework,
  FRAMEWORK_LABELS,
  fieldsForFramework,
  composeStructuredContent,
} from "@/lib/profileTemplates";
import SourceCard from "./SourceCard";

const CATEGORIES = Object.keys(PROFILE_CATEGORY_LABELS) as ProfileCategory[];
const FRAMEWORKS = Object.keys(FRAMEWORK_LABELS) as ExperienceFramework[];

export default function ProfileManager({ initialSources }: { initialSources: ProfileSource[] }) {
  const [sources, setSources] = useState(initialSources);
  const [mode, setMode] = useState<"none" | "text" | "upload">("none");
  const [busy, setBusy] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ProfileCategory>("experience");
  const [content, setContent] = useState("");
  const [framework, setFramework] = useState<ExperienceFramework>("free");
  const [structuredValues, setStructuredValues] = useState<Record<string, string>>({});
  const [file, setFile] = useState<File | null>(null);

  function resetForm() {
    setTitle("");
    setCategory("experience");
    setContent("");
    setFramework("free");
    setStructuredValues({});
    setFile(null);
    setMode("none");
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
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, category, content: finalContent }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const saved = (await res.json()) as ProfileSource;
      setSources((prev) => [saved, ...prev]);
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

  async function importMd(mdFile: File) {
    setImporting(true);
    try {
      const form = new FormData();
      form.set("file", mdFile);
      const res = await fetch("/api/profile/import", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSources((prev) => [...(data.created as ProfileSource[]), ...prev]);
      alert(`${data.created.length}개 항목을 불러왔습니다.`);
    } catch (err) {
      alert((err as Error).message || "불러오기에 실패했습니다.");
    } finally {
      setImporting(false);
      if (importRef.current) importRef.current.value = "";
    }
  }

  return (
    <div>
      <PageHeader
        title="내 정보"
        description="정보/이력/경력/경험/기타로 나누어 등록하면 자소서 생성 시 자동으로 참고합니다. 경험 항목은 STAR 기법이나 3C4P 분석으로 구조화해서 작성할 수 있습니다."
        action={
          mode === "none" ? (
            <>
              <a href="/api/profile/export" download>
                <Button variant="secondary">
                  <Download size={15} /> MD로 내보내기
                </Button>
              </a>
              <input
                ref={importRef}
                type="file"
                accept=".md,.txt"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importMd(f);
                }}
              />
              <Button variant="secondary" onClick={() => importRef.current?.click()} disabled={importing}>
                <FileUp size={15} /> {importing ? "불러오는 중..." : "MD 불러오기"}
              </Button>
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                저장
              </Button>
            </div>
          </form>
        </Card>
      )}

      {mode === "upload" && (
        <Card className="p-5 mb-6">
          <form onSubmit={submitUpload} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
            <SourceCard
              key={s.id}
              source={s}
              onUpdated={(updated) =>
                setSources((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
              }
              onDeleted={(id) => setSources((prev) => prev.filter((p) => p.id !== id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
