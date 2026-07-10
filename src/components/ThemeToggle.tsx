"use client";

import { useSyncExternalStore } from "react";
import { Sun, Moon } from "lucide-react";
import { getSnapshot, getServerSnapshot, subscribe, setTheme } from "@/lib/themeStore";

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggle() {
    setTheme(theme === "dark" ? "light" : "dark");
  }

  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
      className="flex items-center gap-2.5 w-full rounded-lg px-3 py-2 text-sm text-[#52514e] dark:text-[#c3c2b7] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
    >
      {theme === "dark" ? <Sun size={17} strokeWidth={2} /> : <Moon size={17} strokeWidth={2} />}
      {theme === "dark" ? "라이트 모드" : "다크 모드"}
    </button>
  );
}
