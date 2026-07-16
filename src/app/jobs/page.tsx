import { getSession } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/ui";
import JobsSearch from "./JobsSearch";

export default async function JobsPage() {
  const session = await getSession();
  if (!session) {
    return (
      <div>
        <PageHeader title="채용공고" />
        <EmptyState>로그인이 필요합니다.</EmptyState>
      </div>
    );
  }

  return <JobsSearch />;
}
