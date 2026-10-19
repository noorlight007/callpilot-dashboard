/**
 * The only place that knows the backend's response field names.
 * If a shape differs from what the contract says, fix it here.
 */
import type { Me } from "@/lib/ops/types";

type Obj = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Tenant id is the organisation's top-level integer `id` from `GET /organizations/me`. */
export function tenantIdFrom(org: Obj | null | undefined): number {
  const id = Number(org?.id);
  return Number.isSafeInteger(id) && id > 0 ? id : NaN;
}

export function normalizeMe(raw: Obj): Me {
  return { ...raw, ats_connected: !!raw.ats_connected, permissions: raw.permissions ?? {} } as Me;
}

export interface SectionCap {
  name: string;
  list: boolean;
  get: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
  /** "delete" | "archive" | "unavailable" */
  deleteMode: string;
  parent_required?: boolean;
  parent_required_for_create?: boolean;
  path_required?: boolean;
  composite_id_for_get?: boolean;
}

/** `{sections: {name: {list,get,create,update,delete,delete_behavior}}}` */
export function normalizeCapabilities(raw: Obj | null | undefined): SectionCap[] {
  const s = raw?.sections ?? {};
  const rows: Obj[] = Array.isArray(s) ? s : Object.entries(s).map(([name, v]) => ({ name, ...(v as Obj) }));
  return rows
    .map((r) => {
      const b = String(r.delete_behavior ?? "");
      const deleteMode = b === "deleted" ? "delete" : b === "archived" ? "archive" : "unavailable";
      return {
        name: String(r.name ?? ""),
        list: !!r.list,
        get: !!r.get,
        create: !!r.create,
        update: !!r.update,
        delete: deleteMode === "archive" || (!!r.delete && deleteMode === "delete"),
        deleteMode,
        parent_required: !!r.parent_required,
        parent_required_for_create: !!r.parent_required_for_create,
        path_required: !!r.path_required,
        composite_id_for_get: !!r.composite_id_for_get,
      };
    })
    .filter((r) => r.name);
}

export const canWrite = (c?: SectionCap) => !!c && (c.create || c.update);

/** A record read is an action envelope; the useful payload is `after`. */
export const recordPayload = (raw: Obj | null | undefined) => raw?.after ?? raw;

export interface MailboxRow {
  id: string;
  label: string;
  shared: boolean;
  sensitive: boolean;
  log_to_ats: boolean;
  sync_mode: string;
}
export function normalizeMailboxes(raw: unknown): MailboxRow[] {
  const rows: Obj[] = Array.isArray(raw) ? raw : ((raw as Obj)?.results ?? []);
  return rows.map((m) => ({
    id: String(m.id),
    label: String(m.address ?? m.id),
    shared: !!m.shared,
    sensitive: !!m.sensitive,
    log_to_ats: !!m.log_to_ats,
    sync_mode: String(m.sync_mode ?? "native"),
  }));
}

/** Conversation detail is `{conversation, messages}`; flatten it for the UI. */
export function normalizeConversation(raw: Obj | null | undefined): Obj | null {
  if (!raw) return null;
  if (raw.conversation) return { ...raw.conversation, messages: raw.messages ?? raw.conversation.messages ?? [] };
  return raw;
}

/** A message needs investigation when its status/result says so (there is no `review` field). */
export function messageNeedsReview(m: Obj): boolean {
  return m.status === "review";
}

/** Both the calls list `caller_card` and the call-detail card carry `conversation_uid`. */
export const conversationUidOf = (card: Obj | null | undefined): string | undefined => card?.conversation_uid;

/** Link to JobAdder from a caller card; only http(s) URLs are ever linked. */
export function safeUrl(u: unknown): string | undefined {
  if (typeof u !== "string") return undefined;
  try {
    const p = new URL(u);
    return p.protocol === "https:" || p.protocol === "http:" ? p.toString() : undefined;
  } catch {
    return undefined;
  }
}
