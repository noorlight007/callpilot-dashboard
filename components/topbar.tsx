'use client';

import { useEffect, useRef, useState } from 'react';
import { Menu, ChevronDown, User, Check } from 'lucide-react';
import { UserProfilePanel } from './user-profile-panel';
import { profileService } from '@/services/profile-service';

type Organisation = { uid: string; role: string; is_active: boolean; organization?: { name?: string } };

export function Topbar({ onMenuClick, isSidebarOpen }: { onMenuClick: () => void; isSidebarOpen: boolean }) {
  const [showUserPanel, setShowUserPanel] = useState(false);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([profileService.getOrganization({ signal: controller.signal }), profileService.getMyOrganizations()]).then(([org, rows]) => {
      if (controller.signal.aborted) return;
      const items: Organisation[] = rows.data?.results ?? rows.data ?? [];
      setOrganisations(Array.isArray(items) ? items : []);
      setName(items.find(item => item.is_active)?.organization?.name || org.data.business_name || org.data.name || 'Your organisation');
    }).catch(() => { if (!controller.signal.aborted) setError('Unable to load organisations. Reload to try again.'); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (!dropdownRef.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); setShowUserPanel(false); } };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', escape); };
  }, []);
  const switchOrg = async (uid: string) => {
    if (lock.current) return;
    lock.current = true;
    setSwitching(true); setError(''); setOpen(false);
    try { await profileService.switchOrganization(uid); window.location.reload(); }
    catch { lock.current = false; setSwitching(false); setError('Organisation switch failed. Your previous organisation remains selected.'); }
  };
  return <header className="bg-background/90 border-b h-16 flex items-center justify-between gap-3 px-4 md:px-6 sticky top-0 z-50">
    <div ref={dropdownRef} className="relative min-w-0">
      <button disabled={switching || !name} aria-expanded={open} aria-controls="organisation-picker" onClick={() => setOpen(value => !value)} className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-accent text-sm font-medium">
        <span className="truncate">{switching ? 'Switching organisation…' : name || 'Loading organisation…'}</span><ChevronDown size={14} />
      </button>
      {open && <div id="organisation-picker" aria-label="Choose organisation" className="absolute left-0 top-full mt-2 w-72 max-w-[90vw] border rounded-xl bg-background shadow-xl py-2 max-h-96 overflow-y-auto">
        {organisations.map(org => <button key={org.uid} disabled={org.is_active || switching} onClick={() => switchOrg(org.uid)} className="flex items-center gap-2 w-full px-4 py-2 text-left text-sm hover:bg-accent disabled:opacity-70">
          <span className="w-4">{org.is_active && <Check size={14} />}</span>{org.organization?.name || 'Your organisation'}
        </button>)}
        {!organisations.length && <p className="p-3 text-sm text-muted-foreground">No other organisations available.</p>}
      </div>}
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </div>
    <div className="flex items-center gap-4">
      <div className="relative">
        <button onClick={() => setShowUserPanel(value => !value)} className="w-8 h-8 rounded-full border flex items-center justify-center hover:bg-accent" aria-label="User menu" aria-expanded={showUserPanel}><User size={18} /></button>
        {showUserPanel && <div className="absolute right-0 top-full mt-2 z-50"><UserProfilePanel onClose={() => setShowUserPanel(false)} /></div>}
      </div>
      <button onClick={onMenuClick} className="md:hidden" aria-label="Toggle navigation" aria-expanded={isSidebarOpen}><Menu size={24} /></button>
    </div>
  </header>;
}
