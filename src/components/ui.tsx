import type { ReactNode } from "react";
import { CheckCircle2, XCircle, Clock, PenLine, Send, FileCheck2 } from "lucide-react";
import type { ApplicationStatus } from "@/lib/types";
import { APPLICATION_STATUS_LABELS } from "@/lib/types";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border border-[rgba(11,11,11,0.10)] dark:border-[rgba(255,255,255,0.10)] bg-white dark:bg-[#1a1a19] ${className}`}
    >
      {children}
    </div>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-6 gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-[#0b0b0b] dark:text-white">{title}</h1>
        {description && <p className="text-sm text-[#52514e] dark:text-[#c3c2b7] mt-1">{description}</p>}
      </div>
      {action && <div className="flex flex-wrap gap-2 shrink-0">{action}</div>}
    </div>
  );
}

export function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
  className?: string;
}) {
  const styles: Record<string, string> = {
    primary: "bg-[#2a78d6] text-white hover:bg-[#256abf] disabled:bg-[#86b6ef]",
    secondary:
      "bg-transparent border border-[rgba(11,11,11,0.15)] dark:border-[rgba(255,255,255,0.15)] text-[#0b0b0b] dark:text-white hover:bg-black/5 dark:hover:bg-white/5",
    danger: "bg-transparent text-[#d03b3b] hover:bg-[#d03b3b]/10",
    ghost: "bg-transparent text-[#52514e] dark:text-[#c3c2b7] hover:bg-black/5 dark:hover:bg-white/5",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-[rgba(11,11,11,0.15)] dark:border-[rgba(255,255,255,0.15)] bg-transparent px-3 py-2 text-sm text-[#0b0b0b] dark:text-white placeholder:text-[#898781] focus:outline-none focus:ring-2 focus:ring-[#2a78d6]/40 ${props.className ?? ""}`}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-lg border border-[rgba(11,11,11,0.15)] dark:border-[rgba(255,255,255,0.15)] bg-transparent px-3 py-2 text-sm text-[#0b0b0b] dark:text-white placeholder:text-[#898781] focus:outline-none focus:ring-2 focus:ring-[#2a78d6]/40 ${props.className ?? ""}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-lg border border-[rgba(11,11,11,0.15)] dark:border-[rgba(255,255,255,0.15)] bg-white dark:bg-[#1a1a19] px-3 py-2 text-sm text-[#0b0b0b] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2a78d6]/40 ${props.className ?? ""}`}
    />
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="text-center py-10 text-sm text-[#898781] border border-dashed border-[rgba(11,11,11,0.15)] dark:border-[rgba(255,255,255,0.15)] rounded-xl">
      {children}
    </div>
  );
}

const STATUS_ICON: Record<ApplicationStatus, ReactNode> = {
  preparing: <Clock size={12} />,
  writing: <PenLine size={12} />,
  submitted: <Send size={12} />,
  passed_document: <FileCheck2 size={12} />,
  passed_interview: <CheckCircle2 size={12} />,
  rejected: <XCircle size={12} />,
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-white"
      style={{ backgroundColor: `var(--status-${status})` }}
    >
      {STATUS_ICON[status]}
      {APPLICATION_STATUS_LABELS[status]}
    </span>
  );
}
