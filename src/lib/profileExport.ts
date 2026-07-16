// "내 정보" MD 내보내기/불러오기.
// 사람이 읽기 좋은 본문(외부 AI에 붙여넣기용) + 끝에 숨겨진 JSON 데이터 블록(자체 재불러오기용)을 함께 담는다.
import { randomUUID } from "node:crypto";
import type { ProfileCategory, ProfileSource } from "./types";
import { PROFILE_CATEGORY_LABELS } from "./types";

interface ExportRow {
  title: string;
  category: ProfileCategory;
  content: string;
}

export function buildProfileMarkdown(sources: ProfileSource[]): string {
  const byCategory = new Map<ProfileCategory, number>();
  for (const s of sources) byCategory.set(s.category, (byCategory.get(s.category) ?? 0) + 1);

  const summary = [
    `# 내 정보`,
    ``,
    `- 내보낸 시각: ${new Date().toLocaleString("ko-KR")}`,
    `- 총 ${sources.length}건 (${[...byCategory.entries()]
      .map(([c, n]) => `${PROFILE_CATEGORY_LABELS[c]} ${n}`)
      .join(", ")})`,
    ``,
    `자기소개서 작성에 참고할 다른 AI에게 이 문서를 그대로 붙여넣어 활용하세요.`,
    `자소서메이트에 다시 불러오려면 이 파일을 그대로 "MD 불러오기"에 올리면 됩니다.`,
    ``,
  ];

  const body = sources.map((s) => [
    `## ${s.title}`,
    ``,
    `카테고리: ${PROFILE_CATEGORY_LABELS[s.category]}`,
    ``,
    s.content,
    ``,
  ].join("\n"));

  const dataBlock = [
    `## DATA`,
    ``,
    `아래 JSON 블록은 재불러오기용입니다. 수정하지 마세요.`,
    ``,
    "```json",
    JSON.stringify(
      sources.map((s): ExportRow => ({ title: s.title, category: s.category, content: s.content }))
    ),
    "```",
    ``,
  ];

  return [...summary, ...body, ...dataBlock].join("\n");
}

const VALID_CATEGORIES = new Set(Object.keys(PROFILE_CATEGORY_LABELS));
const LABEL_TO_CATEGORY = new Map(
  Object.entries(PROFILE_CATEGORY_LABELS).map(([cat, label]) => [label, cat as ProfileCategory])
);

export function parseProfileMarkdown(md: string): { id: string; title: string; category: ProfileCategory; content: string }[] {
  const jsonMatch = md.match(/```json\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      const rows = JSON.parse(jsonMatch[1]) as ExportRow[];
      if (Array.isArray(rows)) {
        return rows
          .filter((r) => r && typeof r.title === "string" && typeof r.content === "string")
          .map((r) => ({
            id: randomUUID(),
            title: r.title,
            category: VALID_CATEGORIES.has(r.category) ? r.category : "etc",
            content: r.content,
          }));
      }
    } catch {
      // JSON 블록이 손상됐으면 아래 휴리스틱 파서로 폴백
    }
  }

  // 폴백: "## 제목" + "카테고리: X" 패턴을 사람이 손댄 마크다운에서 추출
  const sections = md.split(/^## /m).slice(1);
  const results: { id: string; title: string; category: ProfileCategory; content: string }[] = [];
  for (const section of sections) {
    if (section.startsWith("DATA")) continue;
    const lines = section.split("\n");
    const title = lines[0]?.trim();
    if (!title) continue;
    const rest = lines.slice(1).join("\n").trim();
    const categoryMatch = rest.match(/^카테고리:\s*(.+)$/m);
    const category = categoryMatch ? LABEL_TO_CATEGORY.get(categoryMatch[1].trim()) ?? "etc" : "etc";
    const content = rest.replace(/^카테고리:\s*.+$/m, "").trim();
    if (!content) continue;
    results.push({ id: randomUUID(), title, category, content });
  }
  return results;
}
