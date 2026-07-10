import type { ApplicationStatus } from "@/lib/types";
import { APPLICATION_STATUS_LABELS } from "@/lib/types";

const ORDER: ApplicationStatus[] = [
  "preparing",
  "writing",
  "submitted",
  "passed_document",
  "passed_interview",
  "rejected",
];

export default function StatusDistribution({
  counts,
}: {
  counts: Partial<Record<ApplicationStatus, number>>;
}) {
  const total = ORDER.reduce((sum, s) => sum + (counts[s] ?? 0), 0);

  if (total === 0) {
    return <p className="text-sm text-[#898781]">아직 등록된 지원이 없습니다.</p>;
  }

  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full gap-[2px] bg-[#e1e0d9] dark:bg-[#2c2c2a]">
        {ORDER.filter((s) => (counts[s] ?? 0) > 0).map((s) => {
          const count = counts[s] ?? 0;
          const pct = (count / total) * 100;
          return (
            <div
              key={s}
              title={`${APPLICATION_STATUS_LABELS[s]}: ${count}건`}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{
                width: `${pct}%`,
                backgroundColor: `var(--status-${s})`,
              }}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3">
        {ORDER.map((s) => {
          const count = counts[s] ?? 0;
          if (count === 0) return null;
          return (
            <div key={s} className="flex items-center gap-1.5 text-xs text-[#52514e] dark:text-[#c3c2b7]">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: `var(--status-${s})` }}
              />
              {APPLICATION_STATUS_LABELS[s]}
              <span className="font-medium text-[#0b0b0b] dark:text-white">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
