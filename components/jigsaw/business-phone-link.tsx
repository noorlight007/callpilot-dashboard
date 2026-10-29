'use client';

import type { AnchorHTMLAttributes, MouseEvent } from 'react';

export const BUSINESS_PHONE_WINDOW_NAME = 'callpilot_business_phone';
export const BUSINESS_PHONE_READY_ATTRIBUTE = 'callpilotBusinessPhoneReady';
export const BUSINESS_PHONE_PREFILL = 'callpilot.business-phone.prefill';
export const BUSINESS_PHONE_READY = 'callpilot.business-phone.ready';

export function normalizeBusinessPhoneNumber(value: unknown): string | null {
  if (typeof value !== 'string' || !/^[+0-9 ()-]{3,40}$/.test(value.trim())) return null;
  const number = value.trim().replace(/[ ()-]/g, '');
  return /^(?:\+[1-9]\d{6,14}|\d{3,15})$/.test(number) ? number : null;
}

type PhonePrefill = { type: typeof BUSINESS_PHONE_PREFILL; version: 1; number: string };

export function isBusinessPhonePrefill(value: unknown): value is PhonePrefill {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  return Object.keys(data).sort().join(',') === 'number,type,version'
    && data.type === BUSINESS_PHONE_PREFILL && data.version === 1
    && typeof data.number === 'string'
    && normalizeBusinessPhoneNumber(data.number) === data.number;
}

export function businessPhoneHref(number?: string): string {
  const normalized = normalizeBusinessPhoneNumber(number);
  return `/dashboard/voip${normalized ? `?dial=${encodeURIComponent(normalized)}` : ''}`;
}

let phoneWindow: Window | null = null;
let pendingPrefill: { target: Window; number: string; origin: string } | null = null;
let readinessListenerInstalled = false;

function sendPrefill(target: Window, number: string, origin: string) {
  target.postMessage({ type: BUSINESS_PHONE_PREFILL, version: 1, number } satisfies PhonePrefill, origin);
}

function installReadinessListener() {
  if (readinessListenerInstalled) return;
  window.addEventListener('message', (event: MessageEvent<unknown>) => {
    const pending = pendingPrefill;
    if (!pending || event.origin !== pending.origin || event.source !== pending.target) return;
    const data = event.data;
    if (!data || typeof data !== 'object' || Array.isArray(data)
      || Object.keys(data).sort().join(',') !== 'type,version'
      || (data as Record<string, unknown>).type !== BUSINESS_PHONE_READY
      || (data as Record<string, unknown>).version !== 1) return;
    pendingPrefill = null;
    try { if (!pending.target.closed) sendPrefill(pending.target, pending.number, pending.origin); } catch { /* The phone may have closed or navigated away. */ }
  });
  readinessListenerInstalled = true;
}

/** Open/focus the independent phone. A requested number only fills its dial box. */
export function openBusinessPhone(number?: string): boolean {
  const normalized = normalizeBusinessPhoneNumber(number);
  const origin = window.location.origin;
  installReadinessListener();
  try {
    if (!phoneWindow || phoneWindow.closed) {
      // An empty URL reuses a named window without reloading an existing call.
      phoneWindow = window.open('', BUSINESS_PHONE_WINDOW_NAME, 'popup,width=1100,height=850');
    }
    if (!phoneWindow) return false;
    const target = phoneWindow;
    const current = target.location.href;
    if (current === 'about:blank') {
      pendingPrefill = normalized ? { target, number: normalized, origin } : null;
      target.location.replace(new URL(businessPhoneHref(normalized || undefined), origin).href);
    } else {
      // A named window manually navigated elsewhere must never receive phone data.
      if (target.location.origin !== origin) { phoneWindow = null; pendingPrefill = null; return false; }
      if (target.location.pathname.replace(/\/$/, '') !== '/dashboard/voip') {
        pendingPrefill = normalized ? { target, number: normalized, origin } : null;
        target.location.replace(new URL(businessPhoneHref(normalized || undefined), origin).href);
      } else if (normalized) {
        if (target.document.documentElement.dataset[BUSINESS_PHONE_READY_ATTRIBUTE] === '1') {
          pendingPrefill = null;
          sendPrefill(target, normalized, origin);
        } else {
          pendingPrefill = { target, number: normalized, origin };
        }
      } else {
        pendingPrefill = null;
      }
    }
    try { target.focus(); } catch { /* Browsers may restrict foreground focus. */ }
    return true;
  } catch {
    phoneWindow = null; pendingPrefill = null;
    return false;
  }
}

type BusinessPhoneLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'target' | 'rel'> & { number?: string };

export function BusinessPhoneLink({ number, onClick, children, ...props }: BusinessPhoneLinkProps) {
  const open = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (openBusinessPhone(number)) event.preventDefault();
  };
  return <a {...props} href={businessPhoneHref(number)} target={BUSINESS_PHONE_WINDOW_NAME} onClick={open}>{children}</a>;
}
