import type { NextRequest } from "next/server";
import { SESSION_COOKIE, errorResponse, registerUser, sessionCookieOptions as o, signSession } from "@/lib/server/demo-auth";

export async function POST(req: NextRequest) {
  try {
    const user = await registerUser(await req.json().catch(() => ({})));
    const res = Response.json(user);
    res.headers.append(
      "set-cookie",
      `${SESSION_COOKIE}=${signSession(user)}; Path=${o.path}; Max-Age=${o.maxAge}; HttpOnly; SameSite=Lax${o.secure ? "; Secure" : ""}`
    );
    return res;
  } catch (err) {
    return errorResponse(err);
  }
}
