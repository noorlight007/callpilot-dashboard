import { NextResponse } from 'next/server';
import { BASE_URL } from '@/lib/baseUrl';

export async function POST(request: Request) {
  const access = request.headers.get('cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith('access='))?.slice(7);
  const authorization = request.headers.get('authorization') || (access ? `Bearer ${access}` : '');
  if (!authorization) return NextResponse.json({ error: 'Sign in to your consultant account.' }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } });
  try {
    const body = await request.json();
    const response = await fetch(`${BASE_URL.replace(/\/$/, '')}/voice/api/transfer/`, { method: 'POST', headers: { Authorization: authorization, 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store', signal: AbortSignal.timeout(15000) });
    const data = await response.json().catch(() => ({ error: 'The business phone service is unavailable.' }));
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'The transfer could not be completed.' }, { status: 502, headers: { 'Cache-Control': 'private, no-store' } });
  }
}
