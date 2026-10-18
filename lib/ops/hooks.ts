"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useOps } from "@/lib/ops/session";
import type { ApiOptions } from "@/lib/ops/api";

interface FetchState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  reload: () => void;
}

/**
 * GET helper. Discards data on tenant change, aborts in-flight requests on unmount,
 * and optionally polls (paused while the tab is hidden).
 */
export function useOpsFetch<T = any>(
  path: string | null,
  opts: { query?: ApiOptions["query"]; pollMs?: number } = {}
): FetchState<T> {
  const { call, epoch, tenant } = useOps();
  const queryKey = JSON.stringify(opts.query ?? {});
  // Results are stored with the request they belong to, so a tenant/path/query change
  // can never show the previous one's data (including late responses).
  const reqKey = `${epoch}|${path}|${queryKey}`;
  const [store, setStore] = useState<{ k: string; data: T | null; error: Error | null }>({ k: "", data: null, error: null });
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const seq = useRef(0);
  const setData = (v: T | null) => setStore((s) => ({ k: reqKey, data: v, error: s.k === reqKey ? s.error : null }));
  const setError = (e: Error | null) => setStore((s) => ({ k: reqKey, data: s.k === reqKey ? s.data : null, error: e }));
  const data = store.k === reqKey ? store.data : null;
  const error = store.k === reqKey ? store.error : null;

  useEffect(() => {
    if (!path || tenant == null) return;
    const ctl = new AbortController();
    const mine = ++seq.current;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = async (first: boolean) => {
      if (document.hidden && !first) {
        timer = setTimeout(() => run(false), opts.pollMs);
        return;
      }
      if (first) setLoading(true);
      try {
        const v = await call<T>(path, { query: opts.query, signal: ctl.signal });
        if (mine === seq.current) {
          setData(v);
          setError(null);
        }
      } catch (e: any) {
        if (e?.name !== "AbortError" && mine === seq.current) setError(e);
      } finally {
        if (mine === seq.current) setLoading(false);
        if (opts.pollMs && !ctl.signal.aborted) timer = setTimeout(() => run(false), opts.pollMs);
      }
    };
    run(true);
    return () => {
      ctl.abort();
      if (timer) clearTimeout(timer);
    };
    // setData/setError/opts.query are derived from the deps below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, queryKey, tenant, epoch, tick, opts.pollMs]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload };
}

/** Pull the list out of either a bare array or a paginated `{results}` payload. */
export function listOf(v: any): any[] {
  if (Array.isArray(v)) return v;
  if (Array.isArray(v?.results)) return v.results;
  if (Array.isArray(v?.items)) return v.items;
  if (Array.isArray(v?.data)) return v.data;
  return [];
}
