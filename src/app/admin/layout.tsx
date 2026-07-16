import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

const SUB_NAV = [
  { href: "/admin/users", label: "사용자" },
  { href: "/admin/charges", label: "충전 승인" },
  { href: "/admin/system", label: "시스템 상태" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <div>
      <nav className="flex gap-2 mb-6 border-b border-[rgba(11,11,11,0.10)] dark:border-[rgba(255,255,255,0.10)] pb-3">
        {SUB_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-lg px-3 py-1.5 text-sm text-[#52514e] dark:text-[#c3c2b7] hover:bg-black/5 dark:hover:bg-white/5"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
