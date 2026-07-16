// API 없이도 항상 동작하는 채용 검색 사이트 링크(사람인/잡코리아/링커리어).
export interface ExternalJobLink {
  label: string;
  url: string;
}

export function buildJobSearchLinks(keyword: string): ExternalJobLink[] {
  const q = encodeURIComponent(keyword.trim());
  return [
    { label: "사람인에서 검색", url: `https://www.saramin.co.kr/zf_user/search?searchword=${q}` },
    { label: "잡코리아에서 검색", url: `https://www.jobkorea.co.kr/Search/?stext=${q}` },
    { label: "링커리어에서 검색", url: `https://linkareer.com/cover-letter/search?keyword=${q}` },
  ];
}
