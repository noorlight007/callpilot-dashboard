'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Building2, Check, Loader2, ShieldCheck, ArrowRight } from 'lucide-react';
import { jigsaw, JigsawApiError } from '@/services/jigsaw-service';
import { BASE_URL } from '@/lib/baseUrl';
import { mcpFlow, mcpContinuation } from '@/lib/mcp-authorization';

type Business = { uid: string; name: string; role: string; can_connect: boolean; setup_error: string };
type Consent = { user: { email: string }; businesses: Business[]; scopes: string[]; expires_at: string };
export default function MCPConnectPage() {
  const router = useRouter();
  const [flow, setFlow] = useState<string | null>(null);
  const [data, setData] = useState<Consent | null>(null);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const nonce = mcpFlow(window.location.search);
    if (!nonce) { setError('This connection link is invalid. Start again from ChatGPT.'); return; }
    setFlow(nonce);
    let active = true;
    jigsaw<Consent>(`mcp/authorize/?flow=${encodeURIComponent(nonce)}`).then((result) => {
      if (!active) return;
      setData(result);
      setSelected(result.businesses.find((business) => business.can_connect)?.uid || '');
    }).catch((failure) => {
      if (!active) return;
      if (failure instanceof JigsawApiError && failure.status === 401) {
        router.replace(`/login?next=${encodeURIComponent(`/mcp/connect?flow=${nonce}`)}`);
      } else setError(failure.message || 'Could not load this connection. Start again from ChatGPT.');
    });
    return () => { active = false; };
  }, [router]);
  async function decide(decision: 'allow' | 'deny') {
    if (!flow || busy) return;
    setBusy(true); setError('');
    try {
      const result = await jigsaw<{ continue_url: string }>('mcp/authorize/', 'POST', { flow, business_uid: selected, decision });
      const target = mcpContinuation(result.continue_url, BASE_URL);
      if (!target) throw new Error('A trusted continuation URL was not returned. Ask your administrator to check the MCP server origin.');
      window.location.assign(target);
    } catch (failure) { setError((failure as Error).message); setBusy(false); }
  }
  return <main className="min-h-screen bg-slate-50 px-4 py-12 sm:py-20"><div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
    <div className="mb-7 flex items-center gap-3"><div className="rounded-xl bg-blue-50 p-3 text-blue-600"><ShieldCheck size={27} /></div><div><p className="text-sm font-semibold text-blue-600">CallPilot · AI Jigsaw</p><h1 className="text-2xl font-semibold text-slate-900">Connect to ChatGPT</h1></div></div>
    <p className="mb-5 text-sm leading-6 text-slate-600">Choose the business ChatGPT can access. Its connected JobAdder account must have administrator permission. Your CallPilot role must be Owner or Administrator.</p>
    {!data && !error && <p role="status" className="flex items-center gap-2 text-sm text-slate-600"><Loader2 size={17} className="animate-spin" /> Checking your CallPilot account…</p>}
    {data && <><p className="mb-4 text-sm text-slate-600">Signed in as <strong className="text-slate-900">{data.user.email}</strong></p>
      <fieldset disabled={busy} className="space-y-3"><legend className="mb-2 text-sm font-semibold text-slate-900">Your business</legend>{data.businesses.map((business) => <label key={business.uid} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${selected === business.uid ? 'border-blue-600 bg-blue-50' : 'border-slate-200'} ${!business.can_connect ? 'opacity-60' : ''}`}><input type="radio" name="business" value={business.uid} checked={selected === business.uid} onChange={() => setSelected(business.uid)} disabled={!business.can_connect} className="mt-1" /><Building2 size={20} className="mt-0.5 text-slate-500" /><span><strong className="block text-sm text-slate-900">{business.name}</strong><span className="text-xs text-slate-600">{business.role === 'OWNER' ? 'Owner' : 'Administrator'}</span>{business.setup_error && <span className="mt-1 block text-xs text-amber-800">{business.setup_error}</span>}</span></label>)}</fieldset>
      {!data.businesses.length && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">This account has no eligible business. Ask your business owner to grant Administrator access.</p>}
      <div className="my-6 rounded-xl bg-slate-50 p-4"><p className="mb-3 text-sm font-semibold text-slate-900">You are allowing ChatGPT to:</p><ul className="space-y-3 text-sm text-slate-600">{data.scopes.map((scope) => <li key={scope} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-blue-600" />{scope}</li>)}</ul><p className="mt-4 text-xs leading-5 text-slate-500">JobAdder deletes and bulk actions require confirmation. Financial accounts are read-only. Disconnecting MCP or removing your business access revokes this connection.</p></div>
      <div className="flex gap-3"><button type="button" onClick={() => decide('deny')} disabled={busy} className="rounded-xl border px-4 py-3 text-sm font-medium text-slate-700 disabled:opacity-50">Cancel</button><button type="button" onClick={() => decide('allow')} disabled={busy || !selected} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-50">{busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}Allow connection</button></div>
    </>}
    {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm leading-6 text-red-800">{error}</p>}
    <p className="mt-6 text-center text-xs text-slate-500"><Link href="/dashboard/ai-jigsaw" className="text-blue-600 hover:underline">Open AI Jigsaw settings</Link></p>
  </div></main>;
}
