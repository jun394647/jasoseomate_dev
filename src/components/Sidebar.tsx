"use client";

import Link from "next/link";
import { useRef } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  LayoutDashboard,
  UserRound,
  BookMarked,
  Building2,
  FolderKanban,
  Search,
  Lightbulb,
  ShieldCheck,
} from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import SignOutButton from "./SignOutButton";
import TokenBadge from "./TokenBadge";

const NAV_ITEMS = [
  { href: "/dashboard", label: "대시보드", icon: LayoutDashboard },
  { href: "/profile", label: "내 정보", icon: UserRound },
  { href: "/samples", label: "우수 자소서", icon: BookMarked },
  { href: "/companies", label: "기업 분석", icon: Building2 },
  { href: "/applications", label: "지원 관리", icon: FolderKanban },
  { href: "/insights", label: "인사이트", icon: Lightbulb },
  { href: "/search", label: "검색", icon: Search },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;

  return (
    <aside className="w-60 shrink-0 border-r border-[rgba(11,11,11,0.10)] dark:border-[rgba(255,255,255,0.10)] bg-[#f9f9f7] dark:bg-[#0d0d0d] flex flex-col">
      <div className="px-5 py-5">
        <p className="text-lg font-semibold text-[#0b0b0b] dark:text-white">자소서메이트</p>
        <p className="text-xs text-[#898781] mt-0.5">나만의 자기소개서 작성 도우미</p>
      </div>
      <nav className="flex-1 px-3 space-y-1">
        {status !== "authenticated" ? (
          <Link
            href="/login"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[#2a78d6] dark:text-[#3987e5] font-medium hover:bg-black/5 dark:hover:bg-white/5"
          >
            로그인
          </Link>
        ) : (
          <>
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                    active
                      ? "bg-[#2a78d6]/10 text-[#2a78d6] dark:text-[#3987e5] font-medium"
                      : "text-[#52514e] dark:text-[#c3c2b7] hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
                >
                  <Icon size={17} strokeWidth={2} />
                  {label}
                </Link>
              );
            })}
            {role === "admin" && (
              <Link
                href="/admin"
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                  pathname.startsWith("/admin")
                    ? "bg-[#2a78d6]/10 text-[#2a78d6] dark:text-[#3987e5] font-medium"
                    : "text-[#52514e] dark:text-[#c3c2b7] hover:bg-black/5 dark:hover:bg-white/5"
                }`}
              >
                <ShieldCheck size={17} strokeWidth={2} />
                관리자
              </Link>
            )}
          </>
        )}
      </nav>
      <div className="px-3 py-3 border-t border-[rgba(11,11,11,0.10)] dark:border-[rgba(255,255,255,0.10)]">
        {status === "authenticated" && session?.user && (
          <div className="pb-2 mb-2 border-b border-[rgba(11,11,11,0.08)] dark:border-[rgba(255,255,255,0.08)]">
            <div className="flex items-center justify-between gap-2 px-1">
              <span className="text-xs text-[#52514e] dark:text-[#c3c2b7] truncate">
                {session.user.email}
              </span>
              <SignOutButton />
            </div>
            <TokenBadge />
          </div>
        )}
        <ThemeToggle />
        <SecretFooter />
      </div>
    </aside>
  );
}

// 이스터에그: 하단 캡션을 3초 안에 3번 클릭하면 비밀번호 입력 → 노션 연동 잠금 해제
function SecretFooter() {
  const clicksRef = useRef<number[]>([]);

  async function handleClick() {
    const now = Date.now();
    clicksRef.current = [...clicksRef.current.filter((t) => now - t < 3000), now];
    if (clicksRef.current.length < 3) return;
    clicksRef.current = [];

    const password = window.prompt("비밀번호를 입력하세요:");
    if (!password) return;
    const res = await fetch("/api/notion/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      window.alert("노션 연동이 활성화됐습니다.");
      window.location.reload();
    } else {
      window.alert("비밀번호가 올바르지 않습니다.");
    }
  }

  return (
    <p onClick={handleClick} className="px-3 pt-2 text-[11px] text-[#898781] select-none cursor-default">
      자소서메이트 · AI 기반 생성
    </p>
  );
}
