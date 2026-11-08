'use client';

import Link from 'next/link';
import type { AnchorHTMLAttributes } from 'react';

export const BUSINESS_PHONE_PATH = '/dashboard/ai-jigsaw/workspace/phone';

export function normalizeBusinessPhoneNumber(value: unknown): string | null {
  if (typeof value !== 'string' || !/^[+0-9 ()-]{3,40}$/.test(value.trim())) return null;
  const number = value.trim().replace(/[ ()-]/g, '');
  return /^(?:\+[1-9]\d{6,14}|\d{3,15})$/.test(number) ? number : null;
}

export function businessPhoneHref(number?: string): string {
  const normalized = normalizeBusinessPhoneNumber(number);
  return `${BUSINESS_PHONE_PATH}${normalized ? `?dial=${encodeURIComponent(normalized)}` : ''}`;
}

type BusinessPhoneLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'target' | 'rel'> & { number?: string };

/** Navigate in the existing Jigsaw tab; its layout keeps the phone mounted. */
export function BusinessPhoneLink({ number, children, ...props }: BusinessPhoneLinkProps) {
  return <Link {...props} href={businessPhoneHref(number)}>{children}</Link>;
}
