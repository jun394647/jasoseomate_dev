"use client";

import { useEffect, useState } from "react";
import { Search, ExternalLink, RefreshCw } from "lucide-react";
import { Card, PageHeader, Button, Input, EmptyState } from "@/components/ui";
import type { JobPosting } from "@/lib/worknet";
import type { ExternalJobLink } from "@/lib/jobLinks";

export default function JobsSearch() {
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fallbackLinks, setFallbackLinks] = useState<ExternalJobLink[]>([]);
  const [searched, setSearched] = useState(false);
  // major: 대기업/매출1000대기업/외국계기업으로 좁힌 기본 목록. all: 직접 검색해서 나온, 기업 제한 없는 결과.
  const [scope, setScope] = useState<"major" | "all">("major");

  async function search(term: string, nextScope: "major" | "all") {
    setLoading(true);
    setSearched(true);
    setScope(nextScope);
    try {
      const res = await fetch(
        `/api/jobs/search?keyword=${encodeURIComponent(term)}&scope=${nextScope}`
      );
      const data = await res.json();
      setJobs(data.jobs ?? []);
      setError(data.error ?? null);
      setFallbackLinks(data.fallbackLinks ?? []);
    } catch {
      setError("검색에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  // 페이지에 들어오자마자 검색 없이, 주요 대기업/매출1000대기업/외국계기업 공고를 바로 띄운다.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/jobs/search?keyword=&scope=major`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("요청 실패"))))
      .then((data) => {
        if (cancelled) return;
        setJobs(data.jobs ?? []);
        setError(data.error ?? null);
        setFallbackLinks(data.fallbackLinks ?? []);
        setSearched(true);
      })
      .catch(() => {
        if (!cancelled) {
          setError("검색에 실패했습니다.");
          setSearched(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <PageHeader
        title="채용공고"
        description={
          scope === "major"
            ? "대기업·매출 1000대 기업·외국계기업 공고를 바로 보여드려요. 검색하면 모든 기업의 공고를 찾아볼 수 있어요."
            : `"${keyword}" 검색 결과예요. 모든 기업이 포함됩니다.`
        }
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          search(keyword, "all");
        }}
        className="flex gap-2 mb-3"
      >
        <Input
          placeholder="직무, 키워드, 기업명으로 검색 (예: 프론트엔드 개발자)"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <Button type="submit" disabled={loading}>
          <Search size={15} /> {loading ? "불러오는 중..." : "검색"}
        </Button>
      </form>

      {scope === "all" && (
        <button
          onClick={() => {
            setKeyword("");
            search("", "major");
          }}
          className="mb-3 text-xs text-[#2a78d6] dark:text-[#3987e5] hover:underline"
        >
          ← 대기업·1000대 기업·외국계기업 기본 목록으로 돌아가기
        </button>
      )}

      <div className="mb-6">
        {loading && jobs.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-[#898781] py-8 justify-center">
            <RefreshCw size={14} className="animate-spin" /> 최신 채용공고를 불러오는 중...
          </div>
        ) : searched ? (
          jobs.length > 0 ? (
            <div className="space-y-2">
              {jobs.map((j) => (
                <Card key={`${j.source}-${j.id}`} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#0b0b0b] dark:text-white truncate">
                        {j.title}
                      </p>
                      <p className="text-xs text-[#898781] mt-0.5">
                        {j.companyName}
                        {j.region ? ` · ${j.region}` : ""}
                        {j.career ? ` · ${j.career}` : ""}
                        {j.employmentType ? ` · ${j.employmentType}` : ""}
                        {j.salary ? ` · ${j.salary}` : ""}
                        {j.deadline ? ` · 마감 ${j.deadline}` : ""}
                      </p>
                    </div>
                    <a
                      href={j.url}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 text-[#2a78d6] dark:text-[#3987e5]"
                    >
                      <ExternalLink size={16} />
                    </a>
                  </div>
                </Card>
              ))}
            </div>
          ) : error ? (
            <EmptyState>검색에 실패했습니다: {error}. 아래 링크로 다른 사이트에서 검색해보세요.</EmptyState>
          ) : (
            <EmptyState>검색 결과가 없습니다. 아래 링크로 다른 사이트에서도 찾아보세요.</EmptyState>
          )
        ) : null}
      </div>

      <p className="text-sm font-medium text-[#0b0b0b] dark:text-white mb-2">다른 사이트에서 찾기</p>
      <div className="flex flex-wrap gap-2">
        {(fallbackLinks.length > 0
          ? fallbackLinks
          : [
              { label: "사람인에서 검색", url: "https://www.saramin.co.kr" },
              { label: "잡코리아에서 검색", url: "https://www.jobkorea.co.kr" },
              { label: "링커리어에서 검색", url: "https://linkareer.com" },
            ]
        ).map((link) => (
          <a key={link.url} href={link.url} target="_blank" rel="noreferrer">
            <Button variant="secondary">
              <ExternalLink size={14} /> {link.label}
            </Button>
          </a>
        ))}
      </div>
    </div>
  );
}
