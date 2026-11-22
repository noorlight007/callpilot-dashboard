"use client";

import type { ReactNode, SelectHTMLAttributes } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export const inputClass = "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-base text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-blue-900";
export const primaryButton = "inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
export const secondaryButton = "inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800";

export function Field({ label, htmlFor, children, hint }: { label: string; htmlFor: string; children: ReactNode; hint?: string }) {
  return <div className="space-y-1.5"><label className="block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor={htmlFor}>{label}</label>{children}{hint && <p className="text-sm text-gray-500 dark:text-gray-400">{hint}</p>}</div>;
}

export function NativeSelect({ children, className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <div className="relative"><select {...props} className={cn(inputClass, "appearance-none pr-9", className)}>{children}</select><ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /></div>;
}

const statusStyles: Record<string, string> = {
  APPLIED: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  CALL_PLACED: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200",
  DOCUMENTS_REQUESTED: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  DOCUMENTS_RECEIVED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200",
  SCREENING_PASSED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200",
  UNSUCCESSFUL: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-200",
};
export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <span className={cn("inline-flex rounded-lg px-2.5 py-1 text-sm font-medium", statusStyles[status] || "bg-gray-100 text-gray-600")}>{label || humanize(status)}</span>;
}
export function humanize(value?: string | null) {
  if (value === "CALL_PLACED") return "Called";
  return (value || "Pending").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}
export function dateLabel(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
export function Message({ message, success, onClose }: { message: string; success?: boolean; onClose?: () => void }) {
  return <div role={success ? "status" : "alert"} className={cn("flex items-start gap-2 rounded-xl border p-3 text-sm", success ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200")}>
    {success ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}<p className="flex-1">{message}</p>{onClose && <button type="button" aria-label="Dismiss message" onClick={onClose}><X className="h-4 w-4" /></button>}
  </div>;
}
export function Saving({ children, busy }: { children: ReactNode; busy?: boolean }) {
  return <>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{children}</>;
}
export const activeCallStates = new Set(["QUEUED", "PREPARING", "PLACED"]);
