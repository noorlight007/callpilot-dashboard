'use client';

import { useParams } from 'next/navigation';
import { JigsawDashboard } from '@/components/jigsaw/jigsaw-dashboard';

export default function JigsawPage() {
  const params = useParams<{ section?: string[] }>();
  return <JigsawDashboard section={params.section || []} />;
}
