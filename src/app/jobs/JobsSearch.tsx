"use client";

import { useState } from "react";
import { Search, ExternalLink } from "lucide-react";
import { Card, PageHeader, Button, Input, EmptyState } from "@/components/ui";
import type { JobPosting } from "@/lib/worknet";
import type { ExternalJobLink } from "@/lib/jobLinks";

export default function JobsSearch() {
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fallbackLinks, setFallbackLinks] = useState<ExternalJobLink[]>([]);
  const [searched, setSearched] = useState(false);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/jobs/search?keyword=${encodeURIComponent(keyword)}`);
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

  return (
    <div>
      <PageHeader title="채용공고" description="최신 채용공고를 검색하거나, 다른 채용 사이트에서 바로 찾아보세요." />

      <form onSubmit={search} className="flex gap-2 mb-6">
        <Input
          placeholder="직무, 키워드 (예: 프론트엔드 개발자)"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <Button type="submit" disabled={loading}>
          <Search size={15} /> {loading ? "검색 중..." : "검색"}
        </Button>
      </form>

      {searched && (
        <div className="mb-6">
          {jobs.length > 0 ? (
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
          )}
        </div>
      )}

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
