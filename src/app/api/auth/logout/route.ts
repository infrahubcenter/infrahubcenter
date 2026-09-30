import { SESSION_COOKIE } from "@/lib/server/demo-auth";

export function POST() {
  const res = Response.json({ status: "logged_out" });
  res.headers.append("set-cookie", `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
  return res;
}
