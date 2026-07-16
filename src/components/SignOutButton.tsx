"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="flex items-center gap-1.5 text-xs text-[#898781] hover:text-[#0b0b0b] dark:hover:text-white transition-colors"
    >
      <LogOut size={13} /> 로그아웃
    </button>
  );
}
