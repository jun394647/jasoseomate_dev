"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Coins } from "lucide-react";

export default function TokenBadge() {
  const [state, setState] = useState<{ unlimited: boolean; balance: number | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/tokens/balance")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) setState(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!state) return null;

  return (
    <Link
      href="/charge"
      className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-[#52514e] dark:text-[#c3c2b7] hover:bg-black/5 dark:hover:bg-white/5"
    >
      <Coins size={13} />
      {state.unlimited ? "무제한" : `${state.balance?.toLocaleString() ?? 0} 토큰`}
    </Link>
  );
}
