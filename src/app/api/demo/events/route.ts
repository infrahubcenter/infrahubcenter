import type { NextRequest } from "next/server";
import { readSession, recordEvent } from "@/lib/server/demo-auth";

// Records which feature a demo visitor tried (e.g. "Connecting agents"),
// so the sign-up database shows what people were most interested in.
export async function POST(req: NextRequest) {
  try {
    const user = readSession(req);
    if (!user) return new Response(null, { status: 204 });
    const body = (await req.json().catch(() => ({}))) as { action?: unknown; path?: unknown };
    if (typeof body.action === "string") await recordEvent(user.id, body.action, typeof body.path === "string" ? body.path : "");
  } catch {
    // Best effort only.
  }
  return new Response(null, { status: 204 });
}
