"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Sparkles,
  Save,
  Trash2,
  History,
  ChevronDown,
  StickyNote,
  ClipboardCheck,
  Copy,
  Check,
  Download,
  MessagesSquare,
  ListChecks,
  Newspaper,
  X,
  BookOpen,
  ExternalLink,
  Scissors,
  Feather,
  Split,
  Mic,
  ClipboardList,
  AlertTriangle,
} from "lucide-react";
import { Card, PageHeader, Button, Input, Textarea, Select, StatusBadge } from "@/components/ui";
import type {
  ApplicationWithCompany,
  ApplicationStatus,
  EssayQuestion,
  EssayVersion,
  ProfileSource,
  ProfileCategory,
  InterviewAnswer,
} from "@/lib/types";
import { APPLICATION_STATUS_LABELS, PROFILE_CATEGORY_LABELS, parseJsonStringArray } from "@/lib/types";
import { diffTexts } from "@/lib/diff";
import { useNotionUnlocked } from "@/components/useNotionUnlocked";

export default function ApplicationDetail({
  application,
  initialQuestions,
  versionsByQuestion,
  profileSources,
}: {
  application: ApplicationWithCompany;
  initialQuestions: EssayQuestion[];
  versionsByQuestion: Record<string, EssayVersion[]>;
  profileSources: ProfileSource[];
}) {
  const [app, setApp] = useState(application);
  const [questions, setQuestions] = useState(initialQuestions);
  const [versions, setVersions] = useState(versionsByQuestion);
  const [savingApp, setSavingApp] = useState(false);
  const [addingQuestion, setAddingQuestion] = useState(false);
  const notionUnlocked = useNotionUnlocked();
  const [newQuestion, setNewQuestion] = useState({ question_text: "", max_length: "" });
  const [newQuestionSources, setNewQuestionSources] = useState<string[]>([]);
  const [newQuestionNews, setNewQuestionNews] = useState<string[]>([]);
  const [interview, setInterview] = useState(application.interview_questions);
  const [generatingInterview, setGeneratingInterview] = useState(false);
  const [interviewError, setInterviewError] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [exportingNotion, setExportingNotion] = useState(false);
  const [notionUrl, setNotionUrl] = useState<string | null>(null);
  const [notionError, setNotionError] = useState<string | null>(null);

  async function exportToNotion() {
    setExportingNotion(true);
    setNotionError(null);
    setNotionUrl(null);
    try {
      const res = await fetch(`/api/applications/${app.id}/export-notion`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      setNotionUrl(data.url);
    } catch (err) {
      setNotionError((err as Error).message);
    } finally {
      setExportingNotion(false);
    }
  }

  const answeredQuestions = questions.filter((q) => q.content.trim());

  function buildMarkdown() {
    const lines = [`# ${app.company_name} · ${app.job_role} 자기소개서`, ""];
    questions.forEach((q, i) => {
      lines.push(`## ${i + 1}. ${q.question_text}`);
      if (q.max_length) lines.push(`(글자수 제한: ${q.max_length}자)`);
      lines.push("", q.content.trim() || "(미작성)", "");
    });
    return lines.join("\n");
  }

  async function copyAll() {
    await navigator.clipboard.writeText(buildMarkdown());
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 1500);
  }

  function exportMarkdown() {
    const blob = new Blob([buildMarkdown()], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${app.company_name}_${app.job_role}_자소서.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── 공고 연결 (노션 스크랩) ──
  const [showPosting, setShowPosting] = useState(false);
  const [scraps, setScraps] = useState<
    { id: string; title: string; url: string | null; last_edited: string }[] | null
  >(null);
  const [scrapError, setScrapError] = useState<string | null>(null);
  const [linkingScrap, setLinkingScrap] = useState(false);

  async function openScrapList() {
    setScrapError(null);
    setScraps(null);
    try {
      const res = await fetch("/api/notion/scraps");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (!data.configured) throw new Error("노션 연동이 설정되지 않았습니다.");
      setScraps(data.scraps);
    } catch (err) {
      setScrapError((err as Error).message);
      setScraps([]);
    }
  }

  async function linkScrap(pageId: string) {
    setLinkingScrap(true);
    setScrapError(null);
    try {
      const res = await fetch(`/api/applications/${app.id}/posting`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page_id: pageId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setApp((a) => ({ ...a, posting: data.posting, posting_url: data.posting_url }));
      setScraps(null);
    } catch (err) {
      setScrapError((err as Error).message);
    } finally {
      setLinkingScrap(false);
    }
  }

  // ── 1분 자기소개 ──
  const [selfIntro, setSelfIntro] = useState(application.self_intro);
  const [generatingIntro, setGeneratingIntro] = useState(false);
  const [introError, setIntroError] = useState<string | null>(null);

  async function generateIntro() {
    setGeneratingIntro(true);
    setIntroError(null);
    try {
      const res = await fetch(`/api/applications/${app.id}/self-intro`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSelfIntro(data.self_intro);
    } catch (err) {
      setIntroError((err as Error).message);
    } finally {
      setGeneratingIntro(false);
    }
  }

  async function generateInterview() {
    setGeneratingInterview(true);
    setInterviewError(null);
    try {
      const res = await fetch(`/api/applications/${app.id}/interview`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      setInterview(data.interview_questions);
    } catch (err) {
      setInterviewError((err as Error).message);
    } finally {
      setGeneratingInterview(false);
    }
  }

  async function saveApp(patch: Partial<ApplicationWithCompany>) {
    const next = { ...app, ...patch };
    setApp(next);
    setSavingApp(true);
    try {
      await fetch(`/api/applications/${app.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_role: next.job_role,
          status: next.status,
          deadline: next.deadline,
          notes: next.notes,
        }),
      });
    } finally {
      setSavingApp(false);
    }
  }

  async function addQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!newQuestion.question_text.trim()) return;
    const res = await fetch(`/api/applications/${app.id}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question_text: newQuestion.question_text,
        max_length: newQuestion.max_length ? Number(newQuestion.max_length) : null,
        source_ids: newQuestionSources,
        news: newQuestionNews,
      }),
    });
    if (res.ok) {
      const q = (await res.json()) as EssayQuestion;
      setQuestions((prev) => [...prev, q]);
      setNewQuestion({ question_text: "", max_length: "" });
      setNewQuestionSources([]);
      setNewQuestionNews([]);
      setAddingQuestion(false);
    }
  }

  async function deleteQuestion(id: string) {
    if (!confirm("이 문항을 삭제할까요?")) return;
    setQuestions((prev) => prev.filter((q) => q.id !== id));
    await fetch(`/api/questions/${id}`, { method: "DELETE" });
  }

  function updateQuestionLocal(id: string, patch: Partial<EssayQuestion>) {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }

  function addVersion(questionId: string, version: EssayVersion) {
    setVersions((prev) => ({ ...prev, [questionId]: [version, ...(prev[questionId] ?? [])] }));
  }

  return (
    <div>
      <Link href="/applications" className="inline-flex items-center gap-1 text-sm text-[#898781] hover:text-[#52514e] mb-4">
        <ArrowLeft size={14} /> 지원 목록으로
      </Link>

      <PageHeader
        title={`${app.company_name} · ${app.job_role}`}
        description={app.industry ?? undefined}
        action={
          <>
            <Button variant="secondary" onClick={copyAll} disabled={questions.length === 0}>
              {copiedAll ? <Check size={15} /> : <Copy size={15} />} {copiedAll ? "복사됨" : "전체 복사"}
            </Button>
            <Button variant="secondary" onClick={exportMarkdown} disabled={questions.length === 0}>
              <Download size={15} /> 내보내기
            </Button>
            {notionUnlocked && (
              <Button
                variant="secondary"
                onClick={exportToNotion}
                disabled={exportingNotion || questions.length === 0}
              >
                <BookOpen size={15} /> {exportingNotion ? "노션 저장 중..." : "노션 내보내기"}
              </Button>
            )}
          </>
        }
      />

      {(notionUrl || notionError) && (
        <div className="mb-4 -mt-2">
          {notionUrl && (
            <a
              href={notionUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-[#2a78d6] dark:text-[#3987e5] hover:underline"
            >
              <ExternalLink size={14} /> 노션에 저장됐습니다 — 페이지 열기
            </a>
          )}
          {notionError && <p className="text-xs text-[#d03b3b]">{notionError}</p>}
        </div>
      )}

      <Card className="p-5 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="text-xs text-[#898781] mb-1 block">직무</label>
            <Input
              value={app.job_role}
              onChange={(e) => setApp((a) => ({ ...a, job_role: e.target.value }))}
              onBlur={() => saveApp({})}
            />
          </div>
          <div>
            <label className="text-xs text-[#898781] mb-1 block">상태</label>
            <Select
              value={app.status}
              onChange={(e) => saveApp({ status: e.target.value as ApplicationStatus })}
            >
              {Object.entries(APPLICATION_STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-xs text-[#898781] mb-1 block">마감일</label>
            <Input
              type="date"
              value={app.deadline ?? ""}
              onChange={(e) => saveApp({ deadline: e.target.value })}
            />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <StatusBadge status={app.status} />
          {savingApp && <span className="text-xs text-[#898781]">저장 중...</span>}
        </div>
      </Card>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-medium text-[#0b0b0b] dark:text-white inline-flex items-center gap-1.5">
            <ClipboardList size={15} /> 채용 공고
            {app.posting_url && (
              <a href={app.posting_url} target="_blank" rel="noreferrer" className="text-[#2a78d6] dark:text-[#3987e5]">
                <ExternalLink size={13} />
              </a>
            )}
          </h2>
          <div className="flex gap-2">
            {app.posting && (
              <Button variant="ghost" onClick={() => setShowPosting((v) => !v)} className="!px-2 !py-1 text-xs">
                {showPosting ? "접기" : "내용 보기"}
                <ChevronDown size={13} className={showPosting ? "rotate-180 transition-transform" : "transition-transform"} />
              </Button>
            )}
            {notionUnlocked && (
              <Button variant="secondary" onClick={openScrapList} className="!px-2.5 !py-1 text-xs">
                <BookOpen size={13} /> 노션 스크랩에서 가져오기
              </Button>
            )}
          </div>
        </div>
        {scrapError && <p className="text-xs text-[#d03b3b] mb-2">{scrapError}</p>}
        {scraps !== null && (
          <Card className="p-3 mb-2 max-h-60 overflow-y-auto">
            {scraps.length === 0 && !scrapError ? (
              <p className="text-xs text-[#898781]">공고 스크랩 DB에 항목이 없습니다.</p>
            ) : (
              <ul className="space-y-1">
                {scraps.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => linkScrap(s.id)}
                      disabled={linkingScrap}
                      className="w-full text-left rounded-lg px-2.5 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50"
                    >
                      <span className="text-[#0b0b0b] dark:text-white">{s.title}</span>
                      <span className="text-[10px] text-[#898781] ml-2">
                        {new Date(s.last_edited).toLocaleDateString("ko-KR")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
        {app.posting ? (
          showPosting && (
            <Card className="p-4">
              <pre className="whitespace-pre-wrap font-sans text-xs text-[#52514e] dark:text-[#c3c2b7] leading-relaxed max-h-80 overflow-y-auto">
                {app.posting}
              </pre>
            </Card>
          )
        ) : (
          <p className="text-xs text-[#898781]">
            {notionUnlocked
              ? "노션 '공고 스크랩' DB에서 공고를 연결하면 직무 요건이 자소서 생성·자기소개에 반영됩니다."
              : "연결된 공고가 없습니다."}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-[#0b0b0b] dark:text-white">자소서 문항</h2>
        <Button variant="secondary" onClick={() => setAddingQuestion((v) => !v)}>
          <Plus size={15} /> 문항 추가
        </Button>
      </div>

      {addingQuestion && (
        <Card className="p-4 mb-4">
          <form onSubmit={addQuestion} className="space-y-3">
            <Textarea
              placeholder="자소서 문항을 입력하세요"
              rows={2}
              value={newQuestion.question_text}
              onChange={(e) => setNewQuestion((f) => ({ ...f, question_text: e.target.value }))}
              required
            />
            <div>
              <p className="text-xs text-[#898781] mb-1.5">
                이 문항에서 사용할 경험/이력 선택 (선택 안 하면 자동 검색으로 재료를 찾습니다)
              </p>
              <SourcePicker
                sources={profileSources}
                selected={newQuestionSources}
                onToggle={(id) =>
                  setNewQuestionSources((prev) =>
                    prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
                  )
                }
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs text-[#898781]">
                  이 문항에 활용할 뉴스 기사 첨부 (최대 3개, 예: 지원 동기용 기사)
                </p>
                {newQuestionNews.length < 3 && (
                  <Button
                    variant="ghost"
                    onClick={() => setNewQuestionNews((prev) => [...prev, ""])}
                    className="!px-2 !py-1 text-xs"
                  >
                    <Plus size={13} /> 뉴스 추가
                  </Button>
                )}
              </div>
              {newQuestionNews.length > 0 && (
                <div className="space-y-2">
                  {newQuestionNews.map((n, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Textarea
                        placeholder={`뉴스 ${i + 1} — 기사 제목/요약/본문을 붙여넣으세요`}
                        rows={2}
                        value={n}
                        onChange={(e) =>
                          setNewQuestionNews((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))
                        }
                      />
                      <button
                        type="button"
                        onClick={() => setNewQuestionNews((prev) => prev.filter((_, idx) => idx !== i))}
                        className="p-1.5 mt-1 rounded hover:bg-[#d03b3b]/10 text-[#d03b3b] shrink-0"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                placeholder="글자수 제한 (선택)"
                className="w-40"
                value={newQuestion.max_length}
                onChange={(e) => setNewQuestion((f) => ({ ...f, max_length: e.target.value }))}
              />
              <Button type="submit">추가</Button>
            </div>
          </form>
        </Card>
      )}

      {questions.length === 0 ? (
        <p className="text-sm text-[#898781] text-center py-8 border border-dashed rounded-xl border-[rgba(11,11,11,0.15)] dark:border-[rgba(255,255,255,0.15)]">
          문항을 추가하고 AI 초안 생성을 눌러보세요.
        </p>
      ) : (
        <div className="space-y-4">
          {questions.map((q) => (
            <QuestionCard
              key={q.id}
              question={q}
              profileSources={profileSources}
              versions={versions[q.id] ?? []}
              onUpdate={(patch) => updateQuestionLocal(q.id, patch)}
              onDelete={() => deleteQuestion(q.id)}
              onNewVersion={(v) => addVersion(q.id, v)}
            />
          ))}
        </div>
      )}

      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-[#0b0b0b] dark:text-white inline-flex items-center gap-1.5">
            <Mic size={15} /> 1분 자기소개
          </h2>
          <Button variant="secondary" onClick={generateIntro} disabled={generatingIntro}>
            <Sparkles size={15} /> {generatingIntro ? "생성 중..." : selfIntro ? "다시 생성" : "자기소개 생성"}
          </Button>
        </div>
        {introError && <p className="text-xs text-[#d03b3b] mb-2">{introError}</p>}
        {selfIntro ? (
          <Card className="p-5">
            <pre className="whitespace-pre-wrap font-sans text-sm text-[#0b0b0b] dark:text-white leading-relaxed">
              {selfIntro}
            </pre>
            <p className="text-xs text-[#898781] mt-2">
              공백 포함 {selfIntro.length.toLocaleString()}자 · 말하기 약 {Math.round(selfIntro.length / 550 * 60)}초
            </p>
          </Card>
        ) : (
          <p className="text-sm text-[#898781] text-center py-8 border border-dashed rounded-xl border-[rgba(11,11,11,0.15)] dark:border-[rgba(255,255,255,0.15)]">
            등록된 경험과 기업·공고 정보를 조합해 면접용 1분 자기소개를 만들어보세요.
          </p>
        )}
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-[#0b0b0b] dark:text-white">면접 예상 질문</h2>
          <Button
            variant="secondary"
            onClick={generateInterview}
            disabled={generatingInterview || answeredQuestions.length === 0}
          >
            <MessagesSquare size={15} />
            {generatingInterview ? "생성 중..." : interview ? "다시 생성" : "예상 질문 생성"}
          </Button>
        </div>
        {interviewError && <p className="text-xs text-[#d03b3b] mb-2">{interviewError}</p>}
        {interview ? (
          <InterviewPractice applicationId={app.id} interview={interview} />
        ) : (
          <p className="text-sm text-[#898781] text-center py-8 border border-dashed rounded-xl border-[rgba(11,11,11,0.15)] dark:border-[rgba(255,255,255,0.15)]">
            {answeredQuestions.length === 0
              ? "답안을 작성한 뒤 면접 예상 질문을 생성할 수 있습니다."
              : "작성한 자소서를 기반으로 면접관이 물어볼 질문을 미리 뽑아보세요."}
          </p>
        )}
      </div>
    </div>
  );
}

function QuestionCard({
  question,
  profileSources,
  versions,
  onUpdate,
  onDelete,
  onNewVersion,
}: {
  question: EssayQuestion;
  profileSources: ProfileSource[];
  versions: EssayVersion[];
  onUpdate: (patch: Partial<EssayQuestion>) => void;
  onDelete: () => void;
  onNewVersion: (v: EssayVersion) => void;
}) {
  const [content, setContent] = useState(question.content);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showMemo, setShowMemo] = useState(Boolean(question.memo));
  const [memo, setMemo] = useState(question.memo);
  const [savingMemo, setSavingMemo] = useState(false);
  const [feedback, setFeedback] = useState(question.feedback);
  const [reviewing, setReviewing] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [sourceIds, setSourceIds] = useState<string[]>(() => parseJsonStringArray(question.source_ids ?? "[]"));
  const [savedSourceIds, setSavedSourceIds] = useState<string[]>(() => parseJsonStringArray(question.source_ids ?? "[]"));
  const [showSources, setShowSources] = useState(false);
  const [savingSources, setSavingSources] = useState(false);
  const [qNews, setQNews] = useState<string[]>(() => parseJsonStringArray(question.news ?? "[]"));
  const [savedQNews, setSavedQNews] = useState<string[]>(() => parseJsonStringArray(question.news ?? "[]"));
  const [showNews, setShowNews] = useState(false);
  const [savingNews, setSavingNews] = useState(false);
  const [copied, setCopied] = useState(false);
  const [diffVersionId, setDiffVersionId] = useState<string | null>(null);
  const [rewriting, setRewriting] = useState<"shorten" | "style" | null>(null);
  const [abDrafts, setAbDrafts] = useState<{ a: { label: string; text: string }; b: { label: string; text: string } } | null>(null);
  const [generatingAB, setGeneratingAB] = useState(false);
  const [plagiarism, setPlagiarism] = useState<{ sample_title: string; overlap_text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastCost, setLastCost] = useState<number | null>(null);

  const dirty = content !== question.content;
  const memoDirty = memo !== question.memo;
  const sourcesDirty =
    sourceIds.length !== savedSourceIds.length || sourceIds.some((id) => !savedSourceIds.includes(id));
  const newsDirty =
    qNews.length !== savedQNews.length || qNews.some((n, i) => n !== savedQNews[i]);
  const overLimit = question.max_length ? content.length > question.max_length : false;
  const lengthNoSpace = content.replace(/\s/g, "").length;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/questions/${question.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      onUpdate({ content });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/questions/${question.id}/generate`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      setContent(data.question.content);
      onUpdate({ content: data.question.content });
      setLastCost(data.costUsd);
      setPlagiarism(data.plagiarism ?? null);
      onNewVersion({
        id: crypto.randomUUID(),
        question_id: question.id,
        content: data.question.content,
        source: "ai",
        cost_usd: data.costUsd,
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  function restore(v: EssayVersion) {
    setContent(v.content);
  }

  async function rewrite(mode: "shorten" | "style") {
    if (dirty) {
      setError("저장하지 않은 수정이 있습니다. 먼저 저장하세요.");
      return;
    }
    let targetLength: number | undefined;
    if (mode === "shorten") {
      const input = prompt("목표 글자수를 입력하세요:", String(question.max_length ?? 500));
      if (!input) return;
      targetLength = Number(input);
      if (!targetLength || targetLength < 50) {
        setError("50자 이상의 숫자를 입력하세요.");
        return;
      }
    }
    setRewriting(mode);
    setError(null);
    try {
      const res = await fetch(`/api/questions/${question.id}/rewrite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, target_length: targetLength }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setContent(data.text);
      setLastCost(data.costUsd);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRewriting(null);
    }
  }

  async function generateAB() {
    setGeneratingAB(true);
    setError(null);
    try {
      const res = await fetch(`/api/questions/${question.id}/ab`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAbDrafts({ a: data.a, b: data.b });
      setLastCost(data.costUsd);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGeneratingAB(false);
    }
  }

  function pickDraft(text: string) {
    setContent(text);
    setAbDrafts(null);
  }

  async function review() {
    setReviewing(true);
    setError(null);
    try {
      const res = await fetch(`/api/questions/${question.id}/review`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      setFeedback(data.feedback);
      setShowFeedback(true);
      setLastCost(data.costUsd);
      onUpdate({ feedback: data.feedback });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setReviewing(false);
    }
  }

  async function saveSources() {
    setSavingSources(true);
    setError(null);
    try {
      const res = await fetch(`/api/questions/${question.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_ids: sourceIds }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setSavedSourceIds(sourceIds);
      onUpdate({ source_ids: JSON.stringify(sourceIds) });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingSources(false);
    }
  }

  async function saveQuestionNews() {
    setSavingNews(true);
    setError(null);
    try {
      const clean = qNews.map((n) => n.trim()).filter(Boolean).slice(0, 3);
      const res = await fetch(`/api/questions/${question.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ news: clean }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setQNews(clean);
      setSavedQNews(clean);
      onUpdate({ news: JSON.stringify(clean) });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingNews(false);
    }
  }

  async function copyContent() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function saveMemo() {
    setSavingMemo(true);
    try {
      const res = await fetch(`/api/questions/${question.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memo }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      onUpdate({ memo });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingMemo(false);
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="text-sm font-medium text-[#0b0b0b] dark:text-white">{question.question_text}</h3>
        <button onClick={onDelete} className="p-1.5 rounded hover:bg-[#d03b3b]/10 text-[#d03b3b] shrink-0">
          <Trash2 size={14} />
        </button>
      </div>

      <Textarea
        rows={8}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="AI 초안 생성을 누르거나 직접 작성하세요."
      />

      <div className="flex items-center justify-between mt-2">
        <span className={`text-xs ${overLimit ? "text-[#d03b3b]" : "text-[#898781]"}`}>
          {content.length.toLocaleString()}
          {question.max_length ? ` / ${question.max_length.toLocaleString()}자` : "자"}
          <span className="text-[#898781]"> (공백 제외 {lengthNoSpace.toLocaleString()}자)</span>
        </span>
        {lastCost !== null && (
          <span className="text-xs text-[#898781]">참고 사용량: ${lastCost.toFixed(4)}</span>
        )}
      </div>

      {error && <p className="text-xs text-[#d03b3b] mt-2">{error}</p>}

      {plagiarism && (
        <p className="text-xs text-[#d03b3b] mt-2 inline-flex items-start gap-1.5">
          <AlertTriangle size={13} className="shrink-0 mt-0.5" />
          <span>
            우수 자소서 &ldquo;{plagiarism.sample_title}&rdquo;와 겹치는 구간이 있습니다 (&ldquo;…
            {plagiarism.overlap_text}…&rdquo;). 표현을 바꿔주세요.
          </span>
        </p>
      )}

      {abDrafts && (
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          {[abDrafts.a, abDrafts.b].map((d, i) => (
            <div key={i} className="rounded-lg border border-[#2a78d6]/30 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-[#2a78d6] dark:text-[#3987e5]">
                  {i === 0 ? "A" : "B"} · {d.label} ({d.text.length.toLocaleString()}자)
                </span>
                <Button variant="secondary" onClick={() => pickDraft(d.text)} className="!px-2 !py-1 text-xs">
                  이 버전 사용
                </Button>
              </div>
              <pre className="whitespace-pre-wrap font-sans text-xs text-[#52514e] dark:text-[#c3c2b7] leading-relaxed max-h-56 overflow-y-auto">
                {d.text}
              </pre>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mt-3">
        <Button onClick={generate} disabled={generating}>
          <Sparkles size={15} /> {generating ? "생성 중..." : content ? "AI로 다시 생성" : "AI 초안 생성"}
        </Button>
        <Button variant="secondary" onClick={save} disabled={!dirty || saving}>
          <Save size={15} /> 저장
        </Button>
        <Button variant="secondary" onClick={review} disabled={reviewing || !content.trim()}>
          <ClipboardCheck size={15} /> {reviewing ? "첨삭 중..." : "AI 첨삭"}
        </Button>
        <Button variant="ghost" onClick={generateAB} disabled={generatingAB}>
          <Split size={15} /> {generatingAB ? "A/B 생성 중..." : "A/B 생성"}
        </Button>
        <Button variant="ghost" onClick={() => rewrite("shorten")} disabled={rewriting !== null || !content.trim()}>
          <Scissors size={15} /> {rewriting === "shorten" ? "압축 중..." : "글자수 맞춤"}
        </Button>
        <Button variant="ghost" onClick={() => rewrite("style")} disabled={rewriting !== null || !content.trim()}>
          <Feather size={15} /> {rewriting === "style" ? "재작성 중..." : "내 문체로"}
        </Button>
        <Button variant="ghost" onClick={copyContent} disabled={!content.trim()}>
          {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "복사됨" : "복사"}
        </Button>
        <Button variant="ghost" onClick={() => setShowSources((v) => !v)}>
          <ListChecks size={15} /> 경험 선택{savedSourceIds.length > 0 ? ` (${savedSourceIds.length})` : ""}
          <ChevronDown size={14} className={showSources ? "rotate-180 transition-transform" : "transition-transform"} />
        </Button>
        <Button variant="ghost" onClick={() => setShowNews((v) => !v)}>
          <Newspaper size={15} /> 뉴스{savedQNews.length > 0 ? ` (${savedQNews.length})` : ""}
          <ChevronDown size={14} className={showNews ? "rotate-180 transition-transform" : "transition-transform"} />
        </Button>
        {feedback && (
          <Button variant="ghost" onClick={() => setShowFeedback((v) => !v)}>
            <ClipboardCheck size={15} /> 첨삭 결과
            <ChevronDown size={14} className={showFeedback ? "rotate-180 transition-transform" : "transition-transform"} />
          </Button>
        )}
        {versions.length > 0 && (
          <Button variant="ghost" onClick={() => setShowHistory((v) => !v)}>
            <History size={15} /> 버전 기록 ({versions.length})
            <ChevronDown size={14} className={showHistory ? "rotate-180 transition-transform" : "transition-transform"} />
          </Button>
        )}
        <Button variant="ghost" onClick={() => setShowMemo((v) => !v)}>
          <StickyNote size={15} /> 메모{memo ? " •" : ""}
          <ChevronDown size={14} className={showMemo ? "rotate-180 transition-transform" : "transition-transform"} />
        </Button>
      </div>

      {showSources && (
        <div className="mt-3 border-t border-[rgba(11,11,11,0.10)] dark:border-[rgba(255,255,255,0.10)] pt-3">
          <p className="text-xs text-[#898781] mb-2">
            선택한 경험/이력의 전체 내용을 바탕으로 답안을 생성합니다. 선택하지 않으면 자동 검색으로 재료를 찾습니다.
          </p>
          <SourcePicker
            sources={profileSources}
            selected={sourceIds}
            onToggle={(id) =>
              setSourceIds((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]))
            }
          />
          {sourcesDirty && (
            <div className="flex justify-end mt-2">
              <Button variant="secondary" onClick={saveSources} disabled={savingSources}>
                <Save size={15} /> 선택 저장
              </Button>
            </div>
          )}
        </div>
      )}

      {showNews && (
        <div className="mt-3 border-t border-[rgba(11,11,11,0.10)] dark:border-[rgba(255,255,255,0.10)] pt-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-[#898781]">
              이 문항에 활용할 뉴스 기사 (최대 3개) — 생성 시 답안에 반드시 연결하도록 지시합니다.
            </p>
            {qNews.length < 3 && (
              <Button variant="ghost" onClick={() => setQNews((prev) => [...prev, ""])} className="!px-2 !py-1 text-xs">
                <Plus size={13} /> 뉴스 추가
              </Button>
            )}
          </div>
          {qNews.length === 0 ? (
            <p className="text-xs text-[#898781]">첨부된 뉴스가 없습니다. 지원 동기 문항이라면 관련 기사를 붙여넣어 보세요.</p>
          ) : (
            <div className="space-y-2">
              {qNews.map((n, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Textarea
                    placeholder={`뉴스 ${i + 1} — 기사 제목/요약/본문`}
                    rows={2}
                    value={n}
                    onChange={(e) => setQNews((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))}
                  />
                  <button
                    type="button"
                    onClick={() => setQNews((prev) => prev.filter((_, idx) => idx !== i))}
                    className="p-1.5 mt-1 rounded hover:bg-[#d03b3b]/10 text-[#d03b3b] shrink-0"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {newsDirty && (
            <div className="flex justify-end mt-2">
              <Button variant="secondary" onClick={saveQuestionNews} disabled={savingNews}>
                <Save size={15} /> 뉴스 저장
              </Button>
            </div>
          )}
        </div>
      )}

      {showFeedback && feedback && (
        <div className="mt-3 border-t border-[rgba(11,11,11,0.10)] dark:border-[rgba(255,255,255,0.10)] pt-3">
          <pre className="whitespace-pre-wrap font-sans text-xs text-[#52514e] dark:text-[#c3c2b7] leading-relaxed">
            {feedback}
          </pre>
        </div>
      )}

      {showMemo && (
        <div className="mt-3 border-t border-[rgba(11,11,11,0.10)] dark:border-[rgba(255,255,255,0.10)] pt-3">
          <Textarea
            rows={3}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="이 답안에 대한 메모를 남겨보세요. (수정 방향, 면접관 피드백, 다음에 고칠 점 등)"
          />
          <div className="flex justify-end mt-2">
            <Button variant="secondary" onClick={saveMemo} disabled={!memoDirty || savingMemo}>
              <Save size={15} /> 메모 저장
            </Button>
          </div>
        </div>
      )}

      {showHistory && (
        <div className="mt-3 border-t border-[rgba(11,11,11,0.10)] dark:border-[rgba(255,255,255,0.10)] pt-3 space-y-2">
          {versions.map((v) => (
            <div key={v.id}>
              <div className="flex items-start justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <p className="text-[#898781]">
                    {v.source === "ai" ? "AI 생성" : "직접 수정"} · {new Date(v.created_at).toLocaleString("ko-KR")}
                    {v.cost_usd ? ` · $${v.cost_usd.toFixed(4)}` : ""}
                  </p>
                  <p className="text-[#52514e] dark:text-[#c3c2b7] truncate max-w-md">{v.content}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => setDiffVersionId((cur) => (cur === v.id ? null : v.id))}
                    className="text-[#52514e] dark:text-[#c3c2b7] hover:underline"
                  >
                    {diffVersionId === v.id ? "비교 닫기" : "현재와 비교"}
                  </button>
                  <button onClick={() => restore(v)} className="text-[#2a78d6] dark:text-[#3987e5] hover:underline">
                    이 버전으로 복원
                  </button>
                </div>
              </div>
              {diffVersionId === v.id && (
                <div className="mt-2 rounded-lg bg-black/[0.03] dark:bg-white/[0.04] p-3 text-xs leading-relaxed">
                  <p className="text-[10px] text-[#898781] mb-1.5">
                    <span className="line-through text-[#d03b3b]">빨간 취소선</span> = 이 버전에만 있음 ·{" "}
                    <span className="text-[#1c7a3d] dark:text-[#4fbf74] font-medium">초록</span> = 현재 답안에만 있음
                  </p>
                  <p className="whitespace-pre-wrap text-[#0b0b0b] dark:text-white">
                    {diffTexts(v.content, content).map((part, idx) =>
                      part.type === "same" ? (
                        <span key={idx}>{part.text}</span>
                      ) : part.type === "removed" ? (
                        <span key={idx} className="line-through text-[#d03b3b] bg-[#d03b3b]/10">
                          {part.text}
                        </span>
                      ) : (
                        <span key={idx} className="text-[#1c7a3d] dark:text-[#4fbf74] bg-[#1c7a3d]/10 font-medium">
                          {part.text}
                        </span>
                      )
                    )}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function InterviewPractice({ applicationId, interview }: { applicationId: string; interview: string }) {
  // "1. 질문\n   의도: ..." 형식에서 질문만 추출
  const parsed = interview
    .split("\n")
    .map((line) => line.match(/^\s*\d+\.\s*(.+)$/)?.[1]?.trim())
    .filter((q): q is string => Boolean(q));

  const [records, setRecords] = useState<InterviewAnswer[] | null>(null);
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [answer, setAnswer] = useState("");
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadRecords() {
    const res = await fetch(`/api/applications/${applicationId}/practice`);
    if (res.ok) setRecords((await res.json()) as InterviewAnswer[]);
  }

  function toggle(idx: number) {
    setOpenIdx((cur) => (cur === idx ? null : idx));
    setAnswer("");
    setError(null);
    if (records === null) loadRecords();
  }

  async function evaluate(questionText: string) {
    if (!answer.trim()) return;
    setEvaluating(true);
    setError(null);
    try {
      const res = await fetch(`/api/applications/${applicationId}/practice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question_text: questionText, answer }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRecords((prev) => [data.record as InterviewAnswer, ...(prev ?? [])]);
      setAnswer("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEvaluating(false);
    }
  }

  return (
    <Card className="p-5">
      <p className="text-xs text-[#898781] mb-3">
        질문을 클릭하면 답변을 연습하고 AI 면접관 평가를 받을 수 있습니다.
      </p>
      <div className="space-y-2">
        {parsed.map((q, idx) => {
          const history = (records ?? []).filter((r) => r.question_text === q);
          return (
            <div key={idx} className="rounded-lg border border-[rgba(11,11,11,0.10)] dark:border-[rgba(255,255,255,0.10)]">
              <button
                onClick={() => toggle(idx)}
                className="w-full text-left px-3 py-2.5 text-sm text-[#0b0b0b] dark:text-white flex items-start justify-between gap-2 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
              >
                <span>
                  {idx + 1}. {q}
                </span>
                <span className="flex items-center gap-1.5 shrink-0">
                  {history.length > 0 && (
                    <span className="text-[10px] text-[#2a78d6] dark:text-[#3987e5]">연습 {history.length}회</span>
                  )}
                  <ChevronDown size={14} className={openIdx === idx ? "rotate-180 transition-transform" : "transition-transform"} />
                </span>
              </button>
              {openIdx === idx && (
                <div className="px-3 pb-3 space-y-2">
                  <Textarea
                    rows={4}
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="실제 면접처럼 소리 내어 말한다 생각하고 답변을 적어보세요."
                  />
                  {error && <p className="text-xs text-[#d03b3b]">{error}</p>}
                  <div className="flex justify-end">
                    <Button variant="secondary" onClick={() => evaluate(q)} disabled={evaluating || !answer.trim()}>
                      <Sparkles size={15} /> {evaluating ? "평가 중..." : "AI 면접관 평가"}
                    </Button>
                  </div>
                  {history.map((r) => (
                    <div key={r.id} className="rounded-lg bg-black/[0.03] dark:bg-white/[0.04] p-3">
                      <p className="text-[10px] text-[#898781] mb-1">
                        {new Date(r.created_at).toLocaleString("ko-KR")} 답변: {r.answer.slice(0, 80)}
                        {r.answer.length > 80 ? "…" : ""}
                      </p>
                      <pre className="whitespace-pre-wrap font-sans text-xs text-[#52514e] dark:text-[#c3c2b7] leading-relaxed">
                        {r.feedback}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

const CATEGORY_ORDER: ProfileCategory[] = ["experience", "career", "history", "info", "etc"];

function SourcePicker({
  sources,
  selected,
  onToggle,
}: {
  sources: ProfileSource[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  if (sources.length === 0) {
    return (
      <p className="text-xs text-[#898781]">
        등록된 경험/이력이 없습니다. 내 정보 메뉴에서 먼저 등록하세요.
      </p>
    );
  }

  const groups = sources.reduce<Partial<Record<ProfileCategory, ProfileSource[]>>>((acc, s) => {
    (acc[s.category] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-2">
      {CATEGORY_ORDER.filter((cat) => groups[cat]?.length).map((cat) => (
        <div key={cat}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#898781] mb-1">
            {PROFILE_CATEGORY_LABELS[cat]}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {groups[cat]!.map((s) => {
              const active = selected.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onToggle(s.id)}
                  className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                    active
                      ? "border-[#2a78d6] bg-[#2a78d6]/10 text-[#2a78d6] dark:text-[#3987e5]"
                      : "border-[rgba(11,11,11,0.15)] dark:border-[rgba(255,255,255,0.15)] text-[#52514e] dark:text-[#c3c2b7] hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
                >
                  {active ? "✓ " : ""}
                  {s.title}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
