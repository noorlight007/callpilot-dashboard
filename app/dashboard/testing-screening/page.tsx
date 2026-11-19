"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { TestingScreeningDashboard } from "@/components/testing-screening/dashboard";
import { authService, cookieUtils } from "@/services/auth-service";
import { Loader2 } from "lucide-react";

export default function TestingScreeningPage() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tablet, setTablet] = useState(false);

  useEffect(() => {
    let alive = true;
    const authenticate = async () => {
      const access = cookieUtils.get("access");
      const refresh = cookieUtils.get("refresh");
      if (!access || !refresh) { router.replace("/login"); return; }
      try {
        const verification = await authService.verifyToken(access);
        if (!verification.ok) {
          const response = await authService.refreshToken(refresh);
          if (!response.ok) { router.replace("/login"); return; }
          const tokens = await response.json();
          cookieUtils.set("access", tokens.access, 7);
          if (tokens.refresh) cookieUtils.set("refresh", tokens.refresh, 7);
        }
        if (alive) setAuthenticated(true);
      } catch { router.replace("/login"); }
    };
    void authenticate();
    const resize = () => setTablet(window.innerWidth >= 768);
    resize();
    window.addEventListener("resize", resize);
    return () => { alive = false; window.removeEventListener("resize", resize); };
  }, [router]);

  if (!authenticated) return <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950"><Loader2 className="h-8 w-8 animate-spin text-blue-600" aria-label="Loading your dashboard" /></div>;

  return <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
    <Sidebar isOpen={tablet || sidebarOpen} onClose={() => setSidebarOpen(false)} />
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <Topbar onMenuClick={() => setSidebarOpen((open) => !open)} isSidebarOpen={sidebarOpen} />
      <TestingScreeningDashboard />
    </div>
  </div>;
}
