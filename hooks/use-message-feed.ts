'use client';

import { useCallback, useEffect, useState } from 'react';
import { jigsaw, results, type JsonRecord, type Message } from '@/services/jigsaw-service';
import { messageNeedsRefresh } from '@/lib/message-delivery';

/** Refresh delivery progress without replacing the conversation or its draft. */
export function useMessageFeed(path: string) {
  const [data, setData] = useState<JsonRecord>({ results: [] });
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision(value => value + 1), []);

  useEffect(() => {
    let active = true, inFlight = false, hasPending = false;
    setData({ results: [] });
    setLoading(true);
    setError('');
    const refresh = async (quiet = false) => {
      if (!active || inFlight) return;
      inFlight = true;
      try {
        const next = await jigsaw<JsonRecord>(path);
        if (!active) return;
        hasPending = results<Message>(next).some(messageNeedsRefresh);
        setData(next);
        setError('');
      } catch (failure) {
        // A temporary polling failure must not hide the existing conversation.
        if (active && !quiet) setError((failure as Error).message || 'Unable to load messages.');
      } finally {
        inFlight = false;
        if (active && !quiet) setLoading(false);
      }
    };
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && hasPending) void refresh(true);
    }, 5000);
    const visible = () => { if (document.visibilityState === 'visible') void refresh(true); };
    document.addEventListener('visibilitychange', visible);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [path, revision]);

  return { data, loading, error, reload };
}
