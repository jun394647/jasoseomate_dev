"use client";

import { useEffect, useState } from "react";

// 노션 이스터에그 잠금 상태. 잠겨 있으면 노션 관련 버튼을 렌더링하지 않는다.
export function useNotionUnlocked(): boolean {
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/notion/unlock")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setUnlocked(Boolean(d.unlocked));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return unlocked;
}
