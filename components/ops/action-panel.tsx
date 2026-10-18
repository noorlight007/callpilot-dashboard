"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge, ConfirmYesDialog, ErrorNotice, Json, statusTone, useActionPoll } from "@/components/ops/common";
import { useOps } from "@/lib/ops/session";
import { pilot } from "@/lib/ops/paths";
import { newKey } from "@/lib/ops/api";
import type { ActionEnvelope } from "@/lib/ops/types";

/** Tracks one action to completion and renders the right UI for each status. */
export function ActionPanel({ id, onSettled, deleteMode }: { id: number; onSettled?: (a: ActionEnvelope) => void; deleteMode?: string }) {
  const { tenant, call } = useOps();
  const [nonce, setNonce] = useState(0);
  const [nowRef] = useState(() => Date.now());
  const a = useActionPoll(id, onSettled, nonce);
  const [confirming, setConfirming] = useState(false);
  const [undoErr, setUndoErr] = useState<unknown>(null);
  const [undoId, setUndoId] = useState<number | null>(null);
  if (!a) return <div role="status" className="text-sm text-gray-500">Waiting for action #{id}…</div>;
  // The capabilities response says whether this section deletes or archives.
  const archive = deleteMode === "archive";
  const expired = a.status === "awaiting_confirmation" && !!a.confirmation_expires_at && new Date(a.confirmation_expires_at).getTime() < nowRef;
  return (
    <div className="border rounded-lg p-3 text-sm space-y-2" aria-live="polite">
      <div className="flex items-center gap-2">
        <span className="font-medium">Action #{a.id}</span>
        <Badge tone={statusTone(a.status)}>{a.status.replace("_", " ")}</Badge>
        <span className="text-gray-500">{a.section} {a.operation} {a.target}</span>
      </div>
      {expired && <p role="alert" className="text-amber-700">This proposal expired. Make a new explicit request to continue.</p>}
      {a.status === "awaiting_confirmation" && !expired && (
        <>
          <p>
            This will <strong>{archive ? "archive" : a.operation}</strong> <code>{a.section}/{a.target}</code>
            {a.confirmation_expires_at && <> — expires {new Date(a.confirmation_expires_at).toLocaleTimeString()}</>}.
          </p>
          <Json value={a.request} />
          <Button size="sm" onClick={() => setConfirming(true)}>Review &amp; confirm…</Button>
          <ConfirmYesDialog
            open={confirming}
            onClose={() => setConfirming(false)}
            title={`Confirm ${archive ? "archive" : a.operation}`}
            onConfirm={async () => {
              await call(pilot(tenant!, `actions/${a.id}/confirm/`), { method: "POST", body: { answer: "YES" }, key: `confirm-${a.id}` });
              setNonce((n) => n + 1); // resume polling now that it is queued
            }}
          >
            <p>Section: <strong>{a.section}</strong></p>
            <p>Target: <strong>{a.target}</strong></p>
            <p>Effect: <strong>{archive ? "Archive (recoverable)" : a.operation === "delete" ? "Delete from the provider" : a.operation}</strong></p>
            {a.confirmation_expires_at && <p>Expires: {new Date(a.confirmation_expires_at).toLocaleString()}</p>}
          </ConfirmYesDialog>
        </>
      )}
      {(a.status === "queued" || a.status === "running") && <p className="text-gray-500">In progress…</p>}
      {a.status === "succeeded" && (
        <>
          {a.after != null && <Json value={a.after} />}
          <Button size="sm" variant="outline" onClick={async () => {
            try {
              setUndoErr(null);
              const r = await call<ActionEnvelope>(pilot(tenant!, `actions/${a.id}/undo/`), { method: "POST", key: newKey() });
              setUndoId(r.id);
            } catch (e) { setUndoErr(e); }
          }}>Undo</Button>
          <ErrorNotice error={undoErr} />
          {undoId != null && <ActionPanel id={undoId} onSettled={onSettled} />}
        </>
      )}
      {a.status === "failed" && <ErrorNotice error={new Error(typeof a.error === "string" ? a.error : JSON.stringify(a.error))} />}
      {a.status === "dead_letter" && (
        <p className="text-red-700">
          {a.uncertain_outcome ? "Outcome uncertain — owner reconciliation required. Do not retry blindly." : "This action could not be completed."}
        </p>
      )}
    </div>
  );
}
