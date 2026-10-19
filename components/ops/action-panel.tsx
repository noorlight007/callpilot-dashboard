"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge, ConfirmYesDialog, ErrorNotice, Json, statusTone, useActionPoll } from "@/components/ops/common";
import { useOps } from "@/lib/ops/session";
import { pilot } from "@/lib/ops/paths";
import { useOpsFetch } from "@/lib/ops/hooks";
import { normalizeCapabilities } from "@/lib/ops/adapters";
import type { ActionEnvelope } from "@/lib/ops/types";
import { useMutation } from "./forms";

/** A queued action becomes a success only after the action endpoint reports it. */
type ActionPanelProps = { id: number; onSettled?: (a: ActionEnvelope) => void; deleteMode?: string };
export function ActionPanel(props: ActionPanelProps) {
  const { epoch } = useOps();
  return <ActionPanelBody key={`${epoch}:${props.id}`} {...props} />;
}

function ActionPanelBody({ id, onSettled, deleteMode }: ActionPanelProps) {
  const { tenant, call, isOwner, me } = useOps();
  const [nonce, setNonce] = useState(0);
  const action = useActionPoll(id, onSettled, nonce);
  const [now, setNow] = useState(() => Date.now());
  const [confirming, setConfirming] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const capabilities = useOpsFetch(action?.operation === "delete" || action?.operation === "create" ? pilot(tenant!, "capabilities/") : null);
  const audit = useOpsFetch(isOwner && showAudit ? pilot(tenant!, "audit/") : null, { query: { action_id: id } });
  const undo = useMutation(async (_: void, key) => call<ActionEnvelope>(pilot(tenant!, `actions/${id}/undo/`), { method: "POST", key }));
  useEffect(() => {
    if (action?.status !== "awaiting_confirmation") return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [action?.status]);
  if (!action) return <div role="status" className="text-sm text-gray-500">Loading action #{id}…</div>;
  const cap = normalizeCapabilities(capabilities.data).find((capability) => capability.name === action.section);
  const effect = action.section === "suppliers" ? "delete" : deleteMode ?? cap?.deleteMode;
  const expired = action.status === "awaiting_confirmation" && (!action.confirmation_expires_at || new Date(action.confirmation_expires_at).getTime() <= now);
  const effectKnown = action.operation !== "delete" || effect === "delete" || effect === "archive";
  const requesterMatches = action.user_id == null || Number(action.user_id) === me?.user_id;
  const read = ["get", "read", "list", "search"].includes(action.operation ?? "");
  const hasSnapshot = action.before && typeof action.before === "object" && Object.keys(action.before).length > 0;
  const undoable = action.status === "succeeded" && !read && (
    (action.operation === "update" && hasSnapshot && Object.keys(action.request ?? {}).length > 0) ||
    (action.operation === "delete" && action.after?.outcome === "archived" && hasSnapshot) ||
    (action.operation === "create" && !action.target?.includes("/") && (cap?.delete || action.section === "suppliers"))
  );
  const label = action.operation === "delete" ? effect === "archive" ? "Archive" : effect === "delete" ? "Delete" : "Delete / archive (verify configured behavior)" : action.operation ?? "action";
  return <div className="border rounded-lg p-3 text-sm space-y-3" aria-live="polite">
    <div className="flex flex-wrap items-center gap-2"><span className="font-medium">Action #{action.id}</span><Badge tone={statusTone(action.status)}>{action.status.replaceAll("_", " ")}</Badge><span className="text-gray-500">{action.section} · {action.operation} · {action.target || "new record"}</span></div>
    <ErrorNotice error={typeof action.poll_error === "string" ? new Error(action.poll_error) : action.poll_error} />
    <p className="text-xs text-gray-500">Attempts: {action.attempts ?? 0}{action.created_at && <> · Requested {new Date(action.created_at).toLocaleString()}</>}</p>
    {action.review_required && <p className="text-amber-700">Consultant review is required for this record.</p>}
    {expired && <p role="alert" className="text-amber-700">This proposal expired. Make a new explicit request to continue.</p>}
    {action.status === "awaiting_confirmation" && <>
      <p>Proposed effect: <strong>{label}</strong>. Only the original requester can confirm within 15 minutes. Closing the dialog leaves the proposal unconfirmed.</p>
      {action.confirmation_expires_at && <p>Expires: {new Date(action.confirmation_expires_at).toLocaleString()}</p>}
      {action.section === "suppliers" && action.operation === "delete" && <p className="text-amber-700">This removes the supplier, its notes, documents and local identity mapping. Automatic undo is unavailable.</p>}
      {!effectKnown && <p className="text-amber-700">The current delete/archive behavior must be available before confirmation.</p>}
      <ErrorNotice error={capabilities.error} />
      <Json value={action.request} />
      {!expired && <Button size="sm" disabled={!requesterMatches || !effectKnown} onClick={() => setConfirming(true)}>Review &amp; confirm…</Button>}
      <ConfirmYesDialog open={confirming} onClose={() => setConfirming(false)} title={`Confirm ${label.toLowerCase()}`} onConfirm={async () => {
        if (!effectKnown) throw new Error("The delete/archive behavior is unavailable.");
        if (!action.confirmation_expires_at || Date.parse(action.confirmation_expires_at) <= Date.now()) throw new Error("This proposal has expired. Close this dialog and make a new request.");
        try {
          await call(pilot(tenant!, `actions/${action.id}/confirm/`), { method: "POST", body: { answer: "YES" }, key: `confirm-${action.id}` });
        } finally {
          // A lost response may still have queued the action; reconcile its status.
          setNonce((value) => value + 1);
        }
      }}>
        <p>Section: <strong>{action.section}</strong></p><p>Target: <strong>{action.target || "new record"}</strong></p><p>Effect: <strong>{label}</strong></p>
        <p>Expires: {action.confirmation_expires_at && new Date(action.confirmation_expires_at).toLocaleString()}</p>
        <p>The server verifies the requester and current permissions again.</p><Json value={action.request} />
      </ConfirmYesDialog>
    </>}
    {(action.status === "queued" || action.status === "running") && <p role="status" className="text-gray-500">Queued for provider processing. Waiting for a final result…</p>}
    {action.status === "succeeded" && <>
      {action.after != null && <Json value={action.after} />}
      {undoable ? <><p className="text-xs text-gray-500">Undo depends on captured writable fields and current provider state. Newer conflicting edits can prevent it; an inverse delete needs its own confirmation.</p><Button size="sm" variant="outline" disabled={undo.busy || !!undo.result?.id} onClick={() => undo.submit()}>Request undo</Button></> : !read && <p className="text-xs text-gray-500">Automatic undo is unavailable for this result.</p>}
      <ErrorNotice error={undo.error} />{undo.result?.id && <ActionPanel id={undo.result.id} onSettled={onSettled} />}
    </>}
    {action.status === "failed" && <ErrorNotice error={new Error(typeof action.error === "string" ? action.error : JSON.stringify(action.error ?? "Action failed."))} />}
    {action.status === "dead_letter" && <><p role="alert" className="text-red-700">{action.uncertain_outcome ? "Outcome uncertain. The owner must reconcile provider records before creating another request." : "This action could not be completed. Review its error before creating another request."}</p>{action.error && <Json value={action.error} />}</>}
    {isOwner && <><Button size="sm" variant="ghost" onClick={() => setShowAudit(!showAudit)}>{showAudit ? "Hide audit snapshots" : "View audit snapshots"}</Button>{showAudit && <><ErrorNotice error={audit.error} />{audit.loading && !audit.data ? <p role="status">Loading audit…</p> : <Json value={audit.data} />}</>}</>}
  </div>;
}
