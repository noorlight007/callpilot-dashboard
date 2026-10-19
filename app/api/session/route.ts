import { clearSession, json, sameOrigin, sessionStatus } from "@/lib/server/backend";
export const dynamic = "force-dynamic";
export const GET = (request: Request) => sessionStatus(request);
export const POST = (request: Request) => sessionStatus(request, true);
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return json({ detail: "Cross-origin request refused." }, 403);
  await clearSession();
  return json({ authenticated: false });
}
