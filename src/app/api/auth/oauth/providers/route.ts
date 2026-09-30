import { enabledProviders } from "@/lib/server/oauth";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(enabledProviders());
}
