"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, type ApiOptions } from "@/lib/ops/api";
import type { Me } from "@/lib/ops/types";
import { normalizeMe, tenantIdFrom } from "@/lib/ops/adapters";
import { profileService } from "@/services/profile-service";

interface OpsState {
  tenant: number | null;
  me: Me | null;
  loading: boolean;
  error: Error | null;
  isOwner: boolean;
  isFull: boolean;
  can: (perm: string) => boolean;
  call: <T = any>(path: string, options?: ApiOptions) => Promise<T>;
  epoch: number;
}

const Ctx = createContext<OpsState | null>(null);

export function OpsProvider({ children }: { children: React.ReactNode }) {
  const [tenant, setTenant] = useState<number | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [epoch, setEpoch] = useState(0);
  const controller = useRef(new AbortController());
  const currentTenant = useRef<number | null>(null);

  useEffect(() => {
    let live = true;
    let generation = 0;
    const invalidate = () => {
      generation++;
      controller.current.abort();
      controller.current = new AbortController();
      currentTenant.current = null;
      setTenant(null);
      setMe(null);
      setError(null);
      setLoading(true);
      setEpoch(e => e + 1);
    };
    const load = async () => {
      invalidate();
      const own = generation;
      const signal = controller.current.signal;
      try {
        const org = await profileService.getOrganization({ signal });
        const id = tenantIdFrom(org.data);
        if (!Number.isSafeInteger(id)) throw new Error("No active organisation found. Select an organisation first.");
        const next = normalizeMe(await api<Me>(`/pilot/tenants/${id}/me/`, id, { signal }));
        if (!live || signal.aborted || own !== generation) return;
        currentTenant.current = id;
        setTenant(id);
        setMe(next);
      } catch (e) {
        if (live && !signal.aborted && own === generation) setError(e instanceof Error ? e : new Error("Failed to load your permissions."));
      } finally {
        if (live && !signal.aborted && own === generation) setLoading(false);
      }
    };
    const reload = () => { void load(); };
    window.addEventListener("callpilot:tenant-changing", invalidate);
    window.addEventListener("callpilot:tenant-changed", reload);
    window.addEventListener("callpilot:session-clear", invalidate);
    void load();
    return () => {
      live = false;
      controller.current.abort();
      window.removeEventListener("callpilot:tenant-changing", invalidate);
      window.removeEventListener("callpilot:tenant-changed", reload);
      window.removeEventListener("callpilot:session-clear", invalidate);
    };
  }, []);

  const call = useCallback(async <T,>(path: string, options: ApiOptions = {}): Promise<T> => {
    const scope = controller.current;
    if (tenant == null || tenant !== currentTenant.current || scope.signal.aborted) throw new DOMException("Tenant changed", "AbortError");
    // AbortSignal.any is not available in every supported browser.
    const combined = new AbortController();
    const abort = () => combined.abort();
    const signals = [scope.signal, options.signal].filter((s): s is AbortSignal => !!s);
    for (const signal of signals) {
      if (signal.aborted) combined.abort();
      else signal.addEventListener("abort", abort, { once: true });
    }
    try {
      const value = await api<T>(path, tenant, { ...options, signal: combined.signal });
      if (combined.signal.aborted || currentTenant.current !== tenant) throw new DOMException("Tenant changed", "AbortError");
      return value;
    } finally {
      for (const signal of signals) signal.removeEventListener("abort", abort);
    }
  }, [tenant]);

  const value = useMemo<OpsState>(() => ({
    tenant, me, loading, error, epoch, call,
    isOwner: me?.role === "super_user",
    isFull: me?.role === "super_user" || me?.role === "full_staff",
    can: (perm: string) => !!me?.permissions?.[perm],
  }), [tenant, me, loading, error, epoch, call]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOps() {
  const value = useContext(Ctx);
  if (!value) throw new Error("useOps outside OpsProvider");
  return value;
}
