"use client";

import { useState } from "react";
import { Pencil, Trash2, X, ChevronDown, ChevronUp } from "lucide-react";
import { Card, Button, Input, Textarea, Select } from "@/components/ui";
import type { ProfileSource, ProfileCategory } from "@/lib/types";
import { PROFILE_CATEGORY_LABELS } from "@/lib/types";
import {
  type ExperienceFramework,
  FRAMEWORK_LABELS,
  fieldsForFramework,
  composeStructuredContent,
  parseStructuredContent,
} from "@/lib/profileTemplates";

const CATEGORIES = Object.keys(PROFILE_CATEGORY_LABELS) as ProfileCategory[];
const FRAMEWORKS = Object.keys(FRAMEWORK_LABELS) as ExperienceFramework[];

export default function SourceCard({
  source,
  onUpdated,
  onDeleted,
}: {
  source: ProfileSource;
  onUpdated: (updated: ProfileSource) => void;
  onDeleted: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState(source.title);
  const [category, setCategory] = useState<ProfileCategory>(source.category);
  const [content, setContent] = useState("");
  const [framework, setFramework] = useState<ExperienceFramework>("free");
  const [structuredValues, setStructuredValues] = useState<Record<string, string>>({});

  function startEdit() {
    setTitle(source.title);
    setCategory(source.category);
    const parsed = source.category === "experience" ? parseStructuredContent(source.content) : null;
    if (parsed) {
      setFramework(parsed.framework);
      setStructuredValues(parsed.values);
      setContent("");
    } else {
      setFramework("free");
      setStructuredValues({});
      setContent(source.content);
    }
    setEditing(true);
  }

  const isStructured = category === "experience" && framework !== "free";
  const finalContent = isStructured ? composeStructuredContent(framework, structuredValues) : content;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!finalContent.trim()) {
      alert("내용을 입력해주세요.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/profile/${source.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, category, content: finalContent }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const saved = (await res.json()) as ProfileSource;
      onUpdated(saved);
      setEditing(false);
    } catch (err) {
      alert((err as Error).message || "저장에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("이 자료를 삭제할까요?")) return;
    onDeleted(source.id);
    await fetch(`/api/profile/${source.id}`, { method: "DELETE" });
  }

  if (editing) {
    return (
      <Card className="p-4">
        <form onSubmit={save} className="space-y-3">
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

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              <X size={15} /> 취소
            </Button>
            <Button type="submit" disabled={busy}>
              수정 저장
            </Button>
          </div>
        </form>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs rounded-full px-2 py-0.5 bg-[#2a78d6]/10 text-[#2a78d6] dark:text-[#3987e5] font-medium">
              {PROFILE_CATEGORY_LABELS[source.category]}
            </span>
            <h3 className="text-sm font-medium text-[#0b0b0b] dark:text-white truncate">{source.title}</h3>
          </div>
          <p
            className={`text-sm text-[#52514e] dark:text-[#c3c2b7] whitespace-pre-wrap ${
              expanded ? "" : "line-clamp-3"
            }`}
          >
            {source.content}
          </p>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-1 inline-flex items-center gap-1 text-xs text-[#2a78d6] dark:text-[#3987e5] hover:underline"
          >
            {expanded ? (
              <>
                접기 <ChevronUp size={12} />
              </>
            ) : (
              <>
                더 보기 <ChevronDown size={12} />
              </>
            )}
          </button>
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            onClick={startEdit}
            className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 text-[#52514e] dark:text-[#c3c2b7]"
          >
            <Pencil size={14} />
          </button>
          <button onClick={remove} className="p-1.5 rounded hover:bg-[#d03b3b]/10 text-[#d03b3b]">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </Card>
  );
}
