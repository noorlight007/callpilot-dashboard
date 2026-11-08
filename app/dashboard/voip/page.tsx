import { Suspense } from 'react';
import { LegacyPhoneRedirect } from '@/components/jigsaw/legacy-phone-redirect';

export default function PhonePage() {
  return <Suspense fallback={<p>Opening phone…</p>}><LegacyPhoneRedirect /></Suspense>;
}
