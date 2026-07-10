export type ExperienceFramework = "free" | "star" | "3c4p";

export interface TemplateField {
  key: string;
  label: string;
  placeholder: string;
}

export const FRAMEWORK_LABELS: Record<ExperienceFramework, string> = {
  free: "자유 작성",
  star: "STAR 기법",
  "3c4p": "3C4P 분석",
};

export const STAR_FIELDS: TemplateField[] = [
  { key: "situation", label: "상황 (Situation)", placeholder: "어떤 배경/환경에서 있었던 경험인가요?" },
  { key: "task", label: "과제 (Task)", placeholder: "맡은 역할이나 해결해야 했던 과제는 무엇인가요?" },
  { key: "action", label: "행동 (Action)", placeholder: "과제 해결을 위해 구체적으로 어떤 행동을 했나요?" },
  {
    key: "result",
    label: "성과 (수치)",
    placeholder: "가능한 정량적 수치로 표현한 결과/성과 (예: 처리 시간 40% 단축)",
  },
];

export const C4P_FIELDS: TemplateField[] = [
  { key: "customer", label: "고객 (Customer)", placeholder: "대상 고객/사용자는 누구였나요?" },
  { key: "company", label: "자사 (Company)", placeholder: "우리 팀/조직이 가진 강점과 자원은 무엇이었나요?" },
  { key: "competitor", label: "경쟁사 (Competitor)", placeholder: "경쟁 상대나 대안은 무엇이었나요?" },
  { key: "product", label: "제품/서비스 (Product)", placeholder: "어떤 제품/서비스/기획이었나요?" },
  { key: "price", label: "가격 (Price)", placeholder: "가격 정책이나 비용 관련 고려사항" },
  { key: "place", label: "유통 (Place)", placeholder: "유통 경로나 실행 환경" },
  { key: "promotion", label: "프로모션 (Promotion)", placeholder: "홍보/마케팅 방식" },
  { key: "action", label: "행동", placeholder: "위 분석을 바탕으로 내가 실제로 한 행동" },
  {
    key: "result",
    label: "성과 (수치)",
    placeholder: "가능한 정량적 수치로 표현한 결과/성과 (예: 참여율 25% 증가)",
  },
];

export function fieldsForFramework(fw: ExperienceFramework): TemplateField[] {
  if (fw === "star") return STAR_FIELDS;
  if (fw === "3c4p") return C4P_FIELDS;
  return [];
}

export function composeStructuredContent(
  fw: ExperienceFramework,
  values: Record<string, string>
): string {
  return fieldsForFramework(fw)
    .filter((f) => values[f.key]?.trim())
    .map((f) => `[${f.label}]\n${values[f.key].trim()}`)
    .join("\n\n");
}

function splitSections(content: string): { label: string; text: string }[] {
  const parts = content.trim().split(/\n{2,}(?=\[)/);
  const sections: { label: string; text: string }[] = [];
  for (const part of parts) {
    const m = part.match(/^\[(.+?)\]\n([\s\S]*)$/);
    if (!m) return [];
    sections.push({ label: m[1].trim(), text: m[2].trim() });
  }
  return sections;
}

export function parseStructuredContent(
  content: string
): { framework: ExperienceFramework; values: Record<string, string> } | null {
  const sections = splitSections(content);
  if (sections.length === 0) return null;

  for (const fw of ["star", "3c4p"] as const) {
    const labelToKey = new Map(fieldsForFramework(fw).map((f) => [f.label, f.key]));
    if (sections.every((s) => labelToKey.has(s.label))) {
      const values: Record<string, string> = {};
      for (const s of sections) values[labelToKey.get(s.label)!] = s.text;
      return { framework: fw, values };
    }
  }
  return null;
}
