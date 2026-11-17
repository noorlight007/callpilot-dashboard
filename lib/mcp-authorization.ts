/** Only return to the MCP consent page; never accept an arbitrary login redirect. */
export function mcpLoginDestination(search: string): string | null {
  const raw = new URLSearchParams(search).get('next');
  if (!raw || !raw.startsWith('/mcp/connect?')) return null;
  try {
    const url = new URL(raw, 'https://callpilot.invalid');
    const flow = url.searchParams.get('flow') || '';
    if (url.origin !== 'https://callpilot.invalid' || url.pathname !== '/mcp/connect' || url.hash || !/^[A-Za-z0-9_-]{10,200}$/.test(flow)) return null;
    return `/mcp/connect?flow=${encodeURIComponent(flow)}`;
  } catch { return null; }
}
export function mcpFlow(search: string): string | null {
  const flow = new URLSearchParams(search).get('flow') || '';
  return /^[A-Za-z0-9_-]{10,200}$/.test(flow) ? flow : null;
}
export function mcpContinuation(value: string, apiBase: string): string | null {
  try {
    const url = new URL(value), api = new URL(apiBase);
    const local = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
    if (url.origin !== api.origin || (url.protocol !== 'https:' && !local) || url.username || url.password || url.hash || !/^\/(?:[A-Za-z0-9_-]+\/)+oauth\/callpilot\/callback$/.test(url.pathname)) return null;
    if (!/^[A-Za-z0-9_-]{10,200}$/.test(url.searchParams.get('flow') || '') || !/^[A-Za-z0-9_-]{10,200}$/.test(url.searchParams.get('approval') || '')) return null;
    return url.href;
  } catch { return null; }
}
