"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError, ApiOptions } from "@/lib/ops/api";
import type { Me } from "@/lib/ops/types";
import { normalizeMe, tenantIdFrom } from "@/lib/ops/adapters";
import { profileService } from "@/services/profile-service";

interface OpsState {
  tenant: number | null;
  me: Me | null;
  loading: boolean;
  error: string | null;
  isOwner: boolean;
  isFull: boolean; // owner or full staff
  /** Backend permission flag (can_delete, can_bulk_send, finance, mcp). */
  can: (perm: string) => boolean;
  /** Tenant-scoped request; aborted automatically if the tenant changes. */
  call: <T = any>(path: string, options?: ApiOptions) => Promise<T>;
  /** Bumps whenever tenant changes so views can drop cached data. */
  epoch: number;
}

const Ctx = createContext<OpsState | null>(null);

export function OpsProvider({ children }: { children: React.ReactNode }) {
  const [tenant, setTenant] = useState<number | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [epoch, setEpoch] = useState(0);
  const controller = useRef<AbortController>(new AbortController());

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        // The existing organisation selection supplies the tenant id.
        const org = await profileService.getOrganization();
        const id = tenantIdFrom(org.data);
        if (!Number.isInteger(id)) throw new Error("No active organisation found.");
        const next = normalizeMe(await api<Me>(`/pilot/tenants/${id}/me/`, id));
        if (!live) return;
        controller.current.abort();
        controller.current = new AbortController();
        setTenant(id);
        setMe(next);
        setEpoch((e) => e + 1);
      } catch (e: any) {
        if (live) setError(e instanceof ApiError ? e.message : e?.message ?? "Failed to load");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
      controller.current.abort();
    };
  }, []);

  const call = useCallback(
    <T,>(path: string, options: ApiOptions = {}) => {
      // Combine the tenant-level abort signal with any caller signal.
      const signal = options.signal
        ? (AbortSignal as any).any([options.signal, controller.current.signal])
        : controller.current.signal;
      return api<T>(path, tenant, { ...options, signal });
    },
    [tenant]
  );

  const value = useMemo<OpsState>(
    () => ({
      tenant,
      me,
      loading,
      error,
      epoch,
      call,
      isOwner: me?.role === "super_user",
      isFull: me?.role === "super_user" || me?.role === "full_staff",
      can: (perm: string) => !!me?.permissions?.[perm],
    }),
    [tenant, me, loading, error, epoch, call]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOps() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useOps outside OpsProvider");
  return v;
}
