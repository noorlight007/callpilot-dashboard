'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, Phone } from 'lucide-react';
import { BUSINESS_PHONE_PATH, normalizeBusinessPhoneNumber } from './business-phone-link';
import type { PhoneSessionState } from '@/components/voip-dashboard-content';

const BusinessPhone = dynamic(() => import('@/components/voip-dashboard-content').then((module) => module.VoipDashboardContent),
  { ssr: false, loading: () => <p role="status" className="jigsaw-small">Opening business phone…</p> });

/** This layout-level host is retained while Jigsaw page segments change. */
export function JigsawPhoneHost({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const visible = pathname?.replace(/\/$/, '') === BUSINESS_PHONE_PATH;
  const [activated, setActivated] = useState(visible);
  const [phone, setPhone] = useState<PhoneSessionState | null>(null);
  const number = normalizeBusinessPhoneNumber(search.get('dial'));
  useEffect(() => { if (visible) setActivated(true); }, [visible]);

  return <>
    {activated && !visible && <div className="jigsaw-notice" role="status" style={{ position: 'sticky', top: 0, zIndex: 20, margin: '12px 16px' }}>
      <Phone size={16} /><div className="flex-1 min-w-0">
        <strong>{phone?.incoming ? `Incoming call: ${phone.label}` : phone?.active || phone?.dialing ? `Call: ${phone.label}` : `Business phone: ${phone?.status || 'connecting'}`}</strong>
        <p className="jigsaw-small">Your phone remains connected while you use AI Jigsaw.</p>
      </div><Link className="jigsaw-btn" href={BUSINESS_PHONE_PATH}>{phone?.incoming ? 'Open incoming call' : 'Open phone'}</Link>
    </div>}
    <div hidden={visible}>{children}</div>
    {activated && <section hidden={!visible} aria-label="AI Jigsaw business phone">
      <div className="jigsaw-inline justify-between" style={{ padding: '16px 24px', flexWrap: 'wrap', gap: 12 }}>
        <Link className="jigsaw-link jigsaw-inline" href="/dashboard/ai-jigsaw/workspace/calls"><ArrowLeft size={15} /> Recent calls</Link>
        <nav className="jigsaw-inline" aria-label="Phone workspace">
          <Link className="jigsaw-btn" href="/dashboard/ai-jigsaw/workspace/contacts">Contacts</Link>
          <Link className="jigsaw-btn" href="/dashboard/ai-jigsaw/workspace/messages">Messages</Link>
          <Link className="jigsaw-btn" href="/dashboard/ai-jigsaw/workspace/voicemail">Voicemail</Link>
        </nav>
      </div>
      <BusinessPhone embedded prefillNumber={number} onPhoneStateChange={setPhone} />
    </section>}
  </>;
}
