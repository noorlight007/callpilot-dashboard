'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { isWhatsAppNumber, whatsAppCalling, type WhatsAppCallPermission, type WhatsAppCallingSetup } from '@/services/whatsapp-calling-service';

export function useWhatsAppCalling(number: string, enabled: boolean) {
  const [setup, setSetup] = useState<WhatsAppCallingSetup | null>(null);
  const [permission, setPermission] = useState<WhatsAppCallPermission | null>(null);
  const [loading, setLoading] = useState(false), [requesting, setRequesting] = useState(false);
  const [failure, setFailure] = useState(''), [revision, setRevision] = useState(0);
  const generation = useRef(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    const requestId = ++generation.current;
    setPermission(null); setFailure(''); setRequesting(false);
    if (!enabled) { setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const readiness = await whatsAppCalling.setup(controller.signal);
        if (controller.signal.aborted) return;
        setSetup(readiness);
        if (readiness.outbound_ready && isWhatsAppNumber(number)) {
          const result = await whatsAppCalling.permission(number, controller.signal);
          if (!controller.signal.aborted) setPermission(result);
        }
      } catch (error) {
        if (!controller.signal.aborted) { setSetup(null); setFailure((error as Error).message || 'Unable to check WhatsApp calling.'); }
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, 300);
    return () => { controller.abort(); clearTimeout(timer); if (generation.current === requestId) generation.current++; };
  }, [number, enabled, revision]);
  useEffect(() => {
    if (!enabled || !permission?.expires_at) return;
    const remaining = new Date(permission.expires_at).getTime() - Date.now();
    if (!Number.isFinite(remaining) || remaining <= 0) return;
    const timer = setTimeout(refresh, Math.min(remaining + 50, 2147483647));
    return () => clearTimeout(timer);
  }, [enabled, permission, refresh]);
  const request = async () => {
    if (!enabled || !isWhatsAppNumber(number) || permission?.number !== number || !permission.can_request || requesting) return;
    const requestId = generation.current;
    setRequesting(true); setFailure('');
    try {
      const result = await whatsAppCalling.requestPermission(number);
      if (requestId === generation.current) setPermission(result);
    } catch (error) {
      if (requestId === generation.current) setFailure((error as Error).message || 'Unable to request WhatsApp call permission.');
    } finally { if (requestId === generation.current) setRequesting(false); }
  };
  return { setup, permission, loading, requesting, failure, refresh, request };
}
