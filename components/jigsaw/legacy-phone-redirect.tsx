'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { businessPhoneHref } from './business-phone-link';

export function LegacyPhoneRedirect() {
  const router = useRouter();
  const search = useSearchParams();
  const href = businessPhoneHref(search.get('dial') || undefined);
  useEffect(() => { router.replace(href); }, [router, href]);
  return <p role="status">Opening your AI Jigsaw phone…</p>;
}
