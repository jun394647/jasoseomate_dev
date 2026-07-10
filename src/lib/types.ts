export type ProfileCategory = "info" | "history" | "career" | "experience" | "etc";

export interface ProfileSource {
  id: string;
  title: string;
  category: ProfileCategory;
  content: string;
  created_at: string;
  updated_at: string;
}

export type EssayResult = "합격" | "불합격" | "unknown";

export interface SampleEssay {
  id: string;
  company_name: string | null;
  industry: string | null;
  job_role: string | null;
  question: string;
  content: string;
  result: EssayResult;
  memo: string | null;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  name: string;
  industry: string | null;
  analysis: string | null;
  talent_profile: string | null;
  notes: string | null;
  news: string; // JSON array of news snippets
  ai_report: string;
  created_at: string;
  updated_at: string;
}

export interface CompanyArchive {
  id: string;
  company_id: string;
  title: string;
  content: string;
  url: string | null;
  created_at: string;
}

export function parseJsonStringArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export type ApplicationStatus =
  | "preparing"
  | "writing"
  | "submitted"
  | "passed_document"
  | "passed_interview"
  | "rejected";

export interface Application {
  id: string;
  company_id: string;
  job_role: string;
  status: ApplicationStatus;
  deadline: string | null;
  notes: string | null;
  interview_questions: string;
  posting: string;
  posting_url: string | null;
  self_intro: string;
  created_at: string;
  updated_at: string;
}

export interface InterviewAnswer {
  id: string;
  application_id: string;
  question_text: string;
  answer: string;
  feedback: string;
  created_at: string;
}

export interface ApplicationWithCompany extends Application {
  company_name: string;
  industry: string | null;
}

export interface EssayQuestion {
  id: string;
  application_id: string;
  question_text: string;
  max_length: number | null;
  order_index: number;
  content: string;
  memo: string;
  feedback: string;
  source_ids: string; // JSON array of profile_source ids to base the answer on
  news: string; // JSON array of news snippets attached to this question (max 3)
  created_at: string;
  updated_at: string;
}

export interface EssayVersion {
  id: string;
  question_id: string;
  content: string;
  source: "manual" | "ai";
  cost_usd: number | null;
  created_at: string;
}

export type ChunkSourceType = "profile" | "sample_essay" | "company" | "company_archive";

export interface Chunk {
  id: string;
  source_type: ChunkSourceType;
  source_id: string;
  content: string;
  embedding: string;
  created_at: string;
}

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  preparing: "준비중",
  writing: "작성중",
  submitted: "제출완료",
  passed_document: "서류합격",
  passed_interview: "면접합격",
  rejected: "불합격",
};

export const PROFILE_CATEGORY_LABELS: Record<ProfileCategory, string> = {
  info: "정보",
  history: "이력",
  career: "경력",
  experience: "경험",
  etc: "기타",
};
