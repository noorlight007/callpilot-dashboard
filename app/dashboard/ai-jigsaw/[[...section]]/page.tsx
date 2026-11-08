'use client';

import { useParams } from 'next/navigation';
import { JigsawDashboard } from '@/components/jigsaw/jigsaw-dashboard';

export default function JigsawPage() {
  const params = useParams<{ section?: string[] }>();
  if (params.section?.[0] === 'workspace' && params.section?.[1] === 'phone') return null;
  return <JigsawDashboard section={params.section || []} />;
}
