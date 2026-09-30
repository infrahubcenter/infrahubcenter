import type { NextRequest } from "next/server";
import { isProvider, start } from "@/lib/server/oauth";

export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  if (!isProvider(provider)) return new Response("Not found", { status: 404 });
  return start(req, provider);
}
