'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { jigsaw, type JsonRecord } from '@/services/jigsaw-service';
import { emptyHistory, HISTORY_PAGE_SIZE, mergeConversationPage, type HistoryState } from '@/lib/conversation-history';

type Feed = HistoryState & { loading: boolean; loadingOlder: boolean; error: string };
/** Keep incoming messages and delivery updates live without replacing a draft. */
export function useConversationHistory(key: string) {
  const [data, setData] = useState<Feed>({ ...emptyHistory(), loading: true, loadingOlder: false, error: '' });
  const controller = useRef<{ refresh: () => void; older: () => void } | null>(null);
  useEffect(() => {
    let active = true, inFlight = false, pendingOlder = false, pendingReload = false, current: Feed = { ...emptyHistory(), loading: true, loadingOlder: false, error: '' };
    const commit = (value: Feed) => { current = value; if (active) setData(value); };
    commit(current);
    const request = async (older = false, quiet = false) => {
      if (!active || (older && current.next == null)) return;
      if (inFlight) { if (older) pendingOlder = true; else if (!quiet) pendingReload = true; return; }
      inFlight = true;
      if (older) commit({ ...current, loadingOlder: true, error: '' });
      const offset = older ? current.next : 0;
      try {
        const page = await jigsaw<JsonRecord>(`messages/?conversation_number=${encodeURIComponent(key)}&limit=${HISTORY_PAGE_SIZE}&offset=${offset}`);
        if (!active) return;
        commit({ ...mergeConversationPage(current, page, older), loading: false, loadingOlder: false, error: '' });
      } catch (failure) {
        if (active) commit({ ...current, loading: false, loadingOlder: false,
          error: quiet && current.items.length ? current.error : (failure as Error).message || 'Unable to load this conversation.' });
      } finally {
        inFlight = false;
        if (active && pendingOlder) { pendingOlder = false; void request(true); }
        else if (active && pendingReload) { pendingReload = false; void request(); }
      }
    };
    const controls = { refresh: () => { void request(); }, older: () => { void request(true); } };
    controller.current = controls;
    void request();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void request(false, true); }, 5000);
    const visible = () => { if (document.visibilityState === 'visible') void request(false, true); };
    document.addEventListener('visibilitychange', visible);
    return () => { active = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', visible); if (controller.current === controls) controller.current = null; };
  }, [key]);
  const reload = useCallback(() => controller.current?.refresh(), []);
  const loadOlder = useCallback(() => controller.current?.older(), []);
  return { ...data, reload, loadOlder };
}
