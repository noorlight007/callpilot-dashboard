"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ApiError } from "@/lib/ops/api";
import { useOps } from "@/lib/ops/session";
import { pilot } from "@/lib/ops/paths";
import type { ActionEnvelope } from "@/lib/ops/types";

export function PageHeader({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{title}</h1>
        {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

/** Plain-language next step for common failures. The backend's own message is always shown too. */
function hint(e: unknown): string | null {
  if (!(e instanceof ApiError)) return null;
  const text = JSON.stringify(e.detail ?? "").toLowerCase();
  if (/jobadder|ats/.test(text) && /(connect|login|link|not connected)/.test(text)) return "Your JobAdder login isn't linked. Connect it in Settings, then try again.";
  if (e.status === 403) return "Your role or JobAdder permissions don't allow this. Ask an owner if you need access.";
  if (e.status === 409) return "Someone else changed this first. Refresh to see the current state.";
  if (/opt(ed)?[ -]?out/.test(text)) return "This contact has opted out. The message was not sent, and it won't be retried on another channel.";
  if (/template|24|window/.test(text)) return "Outside the 24-hour window you need an approved template.";
  return null;
}

export function ErrorNotice({ error }: { error: unknown }) {
  if (!error) return null;
  const e = error as any;
  return (
    <div role="alert" className="flex gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-3 text-sm text-red-800 dark:text-red-300">
      <AlertCircle size={16} className="mt-0.5 shrink-0" />
      <div className="whitespace-pre-wrap">
        {e?.message ?? "Something went wrong"}
        {hint(e) && <div className="mt-1 text-xs opacity-80">{hint(e)}</div>}
      </div>
    </div>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-2 text-sm text-gray-500 py-6">
      <Loader2 className="animate-spin" size={16} /> {label}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-gray-500 py-8 text-center border border-dashed rounded-lg">{children}</div>;
}

export function Badge({ children, tone = "gray" }: { children: React.ReactNode; tone?: "gray" | "green" | "red" | "amber" | "blue" }) {
  const tones = {
    gray: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    green: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
    red: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    blue: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  };
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function statusTone(s?: string): "gray" | "green" | "red" | "amber" | "blue" {
  switch (s) {
    case "succeeded":
    case "sent":
    case "delivered":
      return "green";
    case "failed":
    case "dead_letter":
    case "not_sent":
      return "red";
    case "awaiting_confirmation":
    case "unknown":
    case "review":
      return "amber";
    case "queued":
    case "running":
      return "blue";
    default:
      return "gray";
  }
}

export function Json({ value }: { value: unknown }) {
  // Rendered as text only; never injected as HTML.
  return (
    <pre className="text-xs bg-gray-50 dark:bg-gray-900 border rounded-lg p-3 overflow-auto max-h-96 whitespace-pre-wrap break-words">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

/**
 * Confirmation that requires the literal word YES. Closing the dialog never calls onConfirm.
 */
export function ConfirmYesDialog({
  open,
  onClose,
  title,
  children,
  onConfirm,
  confirmLabel = "Confirm",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  onConfirm: () => Promise<void>;
  confirmLabel?: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm">{children}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {/* Mounted only while the dialog is open, so the typed text and error reset each time. */}
        <ConfirmBody busy={busy} setBusy={setBusy} onClose={onClose} onConfirm={onConfirm} confirmLabel={confirmLabel} />
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ConfirmBody({ busy, setBusy, onClose, onConfirm, confirmLabel }: { busy: boolean; setBusy: (b: boolean) => void; onClose: () => void; onConfirm: () => Promise<void>; confirmLabel: string }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<unknown>(null);
  return (
    <>
      <div className="space-y-1">
        <Label htmlFor="confirm-yes">Type YES to confirm</Label>
        {/* Focus moves into the dialog on open so keyboard and screen-reader users land on the confirmation field. */}
        <Input id="confirm-yes" autoFocus value={text} autoComplete="off" onChange={(e) => setText(e.target.value)} />
      </div>
      <ErrorNotice error={error} />
      <AlertDialogFooter>
        <Button variant="outline" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          disabled={text !== "YES" || busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await onConfirm();
              onClose();
            } catch (e) {
              setError(e);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy && <Loader2 className="animate-spin mr-2" size={14} />}
          {confirmLabel}
        </Button>
      </AlertDialogFooter>
    </>
  );
}

/** Poll the action endpoint with backoff, paused in background tabs and scoped to tenant/id. */
export function useActionPoll(id: number | null, onDone?: (a: ActionEnvelope) => void, nonce = 0) {
  const { call, epoch, tenant } = useOps();
  const scopeKey = `${tenant}:${epoch}:${id}:${nonce}`;
  const [state, setState] = useState<{ key: string; action: ActionEnvelope | null }>({ key: "", action: null });
  const done = useRef(onDone);
  useEffect(() => { done.current = onDone; });
  useEffect(() => {
    if (id == null || tenant == null) return;
    const controller = new AbortController();
    let delay = 1000;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let finished = false;
    let running = false;
    const step = async () => {
      if (controller.signal.aborted || finished || running) return;
      if (document.hidden) return;
      running = true;
      try {
        const action = await call<ActionEnvelope>(pilot(tenant, `actions/${id}/`), { signal: controller.signal });
        if (controller.signal.aborted) return;
        setState({ key: scopeKey, action });
        if (["succeeded", "failed", "dead_letter"].includes(action.status)) {
          finished = true;
          done.current?.(action);
        } else if (action.status === "awaiting_confirmation") finished = true;
      } catch (error) {
        if (controller.signal.aborted) return;
        setState(previous => ({ key: scopeKey, action: {
          ...(previous.key === scopeKey ? previous.action : null),
          id, status: previous.key === scopeKey && previous.action ? previous.action.status : "queued",
          poll_error: error instanceof Error ? error.message : "Unable to refresh action status.",
        } }));
      } finally {
        running = false;
        if (!controller.signal.aborted && !finished) {
          delay = Math.min(delay * 1.5, 8000);
          timer = setTimeout(step, delay);
        }
      }
    };
    const onVisibility = () => {
      if (timer) clearTimeout(timer);
      if (!document.hidden) void step();
    };
    document.addEventListener("visibilitychange", onVisibility);
    void step();
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [id, scopeKey, call, tenant]);
  return state.key === scopeKey ? state.action : null;
}
