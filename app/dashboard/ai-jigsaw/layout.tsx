'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Topbar } from '@/components/topbar';
import { apiRequest } from '@/services/jigsaw-service';
import { cookieUtils } from '@/services/auth-service';
import './jigsaw.css';

export default function JigsawLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authError, setAuthError] = useState('');
  useEffect(() => {
    let active = true;
    if (!cookieUtils.get('access') && !cookieUtils.get('refresh')) { router.replace('/login'); return; }
    apiRequest('/me/').then(() => { if (active) setAuthenticated(true); }).catch((error) => {
      if (!active) return;
      if (error.status === 401) router.replace('/login');
      else setAuthError('Unable to check your account. Check your connection and try again.');
    });
    return () => { active = false; };
  }, [router]);
  if (!authenticated) return <div className="jigsaw-auth">{authError ? <div role="alert"><p>{authError}</p><button onClick={() => window.location.reload()}>Try again</button></div> : <><span className="jigsaw-spinner" /><p>Opening AI Jigsaw…</p></>}</div>;
  return <div className="flex h-dvh overflow-hidden bg-white dark:bg-gray-950">
    <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <Topbar isSidebarOpen={sidebarOpen} onMenuClick={() => setSidebarOpen((value) => !value)} />
      <div className="jigsaw-root">{children}</div>
    </div>
  </div>;
}
