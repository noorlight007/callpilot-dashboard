import { proxyBackend } from "@/lib/server/backend";

export async function POST(request: Request) {
  return proxyBackend(request, "/voice/api/transfer/");
}
