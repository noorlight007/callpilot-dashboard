import { signIn } from "@/lib/server/backend";
export const POST = (request: Request) => signIn(request);
