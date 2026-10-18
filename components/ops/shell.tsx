"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Inbox, Database, Truck, Activity, Mail, BarChart3, Landmark, Workflow, Settings, ArrowLeft,
} from "lucide-react";
import { Topbar } from "@/components/topbar";
import { OpsProvider, useOps } from "@/lib/ops/session";
import { cookieUtils } from "@/services/auth-service";
import { Loading, ErrorNotice } from "@/components/ops/common";

const NAV = [
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/records/candidates", label: "Records", icon: Database, match: "/records" },
  { href: "/suppliers", label: "Suppliers", icon: Truck },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/mail", label: "Mail", icon: Mail },
  { href: "/reports", label: "Reports", icon: BarChart3, owner: true },
  { href: "/finance", label: "Finance", icon: Landmark, perm: "finance" },
  { href: "/automations", label: "Automations", icon: Workflow, full: true },
  { href: "/settings", label: "Settings", icon: Settings },
];

function Nav() {
  const pathname = usePathname();
  const { isOwner, isFull, can } = useOps();
  return (
    <nav aria-label="Operations" className="w-52 shrink-0 border-r border-gray-200 dark:border-gray-800 p-3 space-y-1 overflow-y-auto hidden md:block">
      <Link href="/dashboard" className="flex items-center gap-2 px-3 py-2 text-xs text-gray-500 hover:text-gray-900">
        <ArrowLeft size={14} /> Back to dashboard
      </Link>
      {/* Owner-only routes are not rendered at all for staff. */}
      {NAV.filter((n) => (!n.owner || isOwner) && (!(n as any).full || isFull) && (!(n as any).perm || can((n as any).perm))).map((n) => {
        const active = pathname.startsWith(n.match ?? n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${active ? "bg-gray-200 dark:bg-gray-800 font-semibold" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
          >
            <n.icon size={18} /> {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Gate({ children }: { children: React.ReactNode }) {
  const { loading, error, me } = useOps();
  if (loading) return <div className="p-6"><Loading /></div>;
  if (error || !me) return <div className="p-6"><ErrorNotice error={new Error(error ?? "Unable to load your permissions")} /></div>;
  return <>{children}</>;
}

export function OpsShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    // Cookies are only readable on the client; checking after mount avoids a hydration mismatch.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!cookieUtils.get("access") || !cookieUtils.get("refresh")) router.replace("/login");
    else setAuthed(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [router]);
  if (!authed) return <div className="p-6"><Loading /></div>;
  return (
    <OpsProvider>
      <div className="flex flex-col h-screen bg-white dark:bg-gray-950 overflow-hidden">
        <Topbar onMenuClick={() => router.push("/dashboard")} isSidebarOpen={false} />
        <div className="flex flex-1 overflow-hidden">
          <Nav />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <Gate>{children}</Gate>
          </main>
        </div>
      </div>
    </OpsProvider>
  );
}

/** Renders children only for allowed roles; no data is fetched for others. */
export function Require({ owner, full, perm, children }: { owner?: boolean; full?: boolean; perm?: string; children: React.ReactNode }) {
  const { isOwner, isFull, can } = useOps();
  if ((owner && !isOwner) || (full && !isFull) || (perm && !can(perm))) {
    return <ErrorNotice error={new Error("You don't have access to this section.")} />;
  }
  return <>{children}</>;
}
