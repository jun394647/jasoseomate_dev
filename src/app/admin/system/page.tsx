import { getDb } from "@/lib/db";
import { Card, PageHeader } from "@/components/ui";
import { isNotionConfigured } from "@/lib/notion";

async function checkDb(): Promise<boolean> {
  try {
    const db = await getDb();
    await db.prepare(`SELECT 1`).get();
    return true;
  } catch {
    return false;
  }
}

function StatusRow({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[rgba(11,11,11,0.06)] dark:border-[rgba(255,255,255,0.06)] last:border-0">
      <div>
        <p className="text-sm text-[#0b0b0b] dark:text-white">{label}</p>
        {detail && <p className="text-xs text-[#898781] mt-0.5">{detail}</p>}
      </div>
      <span
        className={`text-xs font-medium rounded-full px-2.5 py-1 ${
          ok ? "bg-[#2a78d6]/10 text-[#2a78d6] dark:text-[#3987e5]" : "bg-[#d03b3b]/10 text-[#d03b3b]"
        }`}
      >
        {ok ? "정상" : "미설정"}
      </span>
    </div>
  );
}

export default async function AdminSystemPage() {
  const dbOk = await checkDb();
  const notionOk = isNotionConfigured();
  const llmProvider = (process.env.LLM_PROVIDER ?? "claude").toLowerCase();
  const llmOk = llmProvider === "glm" ? Boolean(process.env.GLM_API_KEY) : true;
  const worknetOk = Boolean(process.env.WORKNET_API_KEY);

  return (
    <div>
      <PageHeader title="시스템 상태" description="핵심 연동의 설정 여부를 확인합니다." />
      <Card className="p-5">
        <StatusRow label="데이터베이스" ok={dbOk} detail="Turso / SQLite 연결" />
        <StatusRow
          label="노션 연동"
          ok={notionOk}
          detail="NOTION_API_KEY, NOTION_PARENT_PAGE_ID"
        />
        <StatusRow
          label="AI 생성 (LLM)"
          ok={llmOk}
          detail={`LLM_PROVIDER=${llmProvider}${llmProvider === "glm" ? " · GLM_API_KEY" : " (로컬 claude CLI)"}`}
        />
        <StatusRow label="워크넷 채용정보 API" ok={worknetOk} detail="WORKNET_API_KEY" />
      </Card>
    </div>
  );
}
