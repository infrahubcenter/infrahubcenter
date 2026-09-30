import type { NextRequest } from "next/server";
import { errorResponse, readSession } from "@/lib/server/demo-auth";

export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  try {
    const user = readSession(req);
    if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
    return Response.json(user);
  } catch (err) {
    return errorResponse(err);
  }
}
