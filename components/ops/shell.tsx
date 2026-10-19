"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Inbox, Database, Truck, Activity, Mail, BarChart3, Landmark, Workflow, Settings, ArrowLeft, Phone } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { OpsProvider, useOps } from "@/lib/ops/session";
import { authService } from "@/services/auth-service";
import { Loading, ErrorNotice } from "@/components/ops/common";

const NAV = [
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/records/candidates", label: "Records", icon: Database, match: "/records" },
  { href: "/suppliers", label: "Suppliers", icon: Truck },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/mail", label: "Mail", icon: Mail },
  { href: "/reports", label: "Reports", icon: BarChart3, owner: true },
  { href: "/finance", label: "Finance", icon: Landmark, owner: true, perm: "finance" },
  { href: "/automations", label: "Automations", icon: Workflow, full: true },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/dashboard/voip", label: "Softphone", icon: Phone },
];

function Nav({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const pathname = usePathname();
  const { isOwner, isFull, can, me } = useOps();
  return <>
    {open && <button aria-label="Close navigation" className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={onNavigate} />}
    <nav aria-label="Operations" className={`${open ? "block" : "hidden"} fixed inset-y-16 left-0 z-40 w-56 bg-background border-r p-3 space-y-1 overflow-y-auto md:static md:block md:shrink-0 md:z-auto`}>
      <Link href="/dashboard" onClick={onNavigate} className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground"><ArrowLeft size={14} /> Dashboard</Link>
      {me && <p className="px-3 py-2 text-xs text-muted-foreground">{me.role.replaceAll("_", " ")}</p>}
      {NAV.filter(n => (!n.owner || isOwner) && (!n.full || isFull) && (!n.perm || can(n.perm))).map(n => {
        const active = pathname.startsWith(n.match ?? n.href);
        return <Link key={n.href} href={n.href} onClick={onNavigate} aria-current={active ? "page" : undefined}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${active ? "bg-accent font-semibold" : "text-muted-foreground hover:bg-accent"}`}>
          <n.icon size={18} /> {n.label}
        </Link>;
      })}
    </nav>
  </>;
}

function Gate({ children }: { children: React.ReactNode }) {
  const { loading, error, me, epoch } = useOps();
  if (loading) return <Loading label="Loading organisation and permissions…" />;
  if (error || !me) return <div className="space-y-4"><ErrorNotice error={error ?? new Error("Unable to load your permissions")} /><p className="text-sm">Select an organisation with an active CallPilot membership, or <Link className="underline" href="/login?reauth=1">sign in again</Link>.</p></div>;
  return <div key={epoch}>{children}</div>;
}

export function OpsShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => {
    let live = true;
    authService.verifyToken().then(res => {
      if (!live) return;
      if (res.status === 401) router.replace("/login");
      else if (!res.ok) setError(new Error("Unable to check your session. Reload to try again."));
      else setAuthed(true);
    }).catch(() => { if (live) setError(new Error("Unable to check your session. Reload to try again.")); });
    return () => { live = false; };
  }, [router]);
  if (!authed) return <div className="p-6">{error ? <ErrorNotice error={error} /> : <Loading />}</div>;
  return <OpsProvider>
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <Topbar onMenuClick={() => setNavOpen(open => !open)} isSidebarOpen={navOpen} />
      <div className="flex flex-1 overflow-hidden">
        <Nav open={navOpen} onNavigate={() => setNavOpen(false)} />
        <main id="operations-main" className="flex-1 min-w-0 overflow-y-auto p-4 md:p-6"><Gate>{children}</Gate></main>
      </div>
    </div>
  </OpsProvider>;
}

/** Protected children never mount until membership is known and permitted. */
export function Require({ owner, full, perm, children }: { owner?: boolean; full?: boolean; perm?: string; children: React.ReactNode }) {
  const { loading, me, isOwner, isFull, can } = useOps();
  if (loading || !me) return <Loading label="Checking permissions…" />;
  if ((owner && !isOwner) || (full && !isFull) || (perm && !can(perm))) return <ErrorNotice error={new Error("You don't have access to this section.")} />;
  return <>{children}</>;
}
