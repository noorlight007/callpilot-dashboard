import { proxyBackend, json } from "@/lib/server/backend";

export const dynamic = "force-dynamic";

async function handle(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  if (path.some((part) => /[/\\?#]/.test(part) || part === "." || part === "..")) return json({ detail: "Invalid API path." }, 400);
  const trailing = new URL(request.url).pathname.endsWith("/") ? "/" : "";
  return proxyBackend(request, `/${path.map(encodeURIComponent).join("/")}${trailing}`);
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
