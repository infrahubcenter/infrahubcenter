// Server-only: "Continue with Google / GitHub" for demo accounts. Each
// provider is enabled simply by setting its client id + secret on the
// deployment (GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET,
// GITHUB_CLIENT_ID/GITHUB_CLIENT_SECRET); the callback URL to register with
// the provider is <site>/api/auth/oauth/<provider>/callback.

import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { DemoAuthError, sessionCookieHeader, upsertOAuthUser } from "./demo-auth";

export type Provider = "google" | "github";
const STATE_COOKIE = "infrahub_demo_oauth_state";

function creds(p: Provider) {
  const id = process.env[p === "google" ? "GOOGLE_CLIENT_ID" : "GITHUB_CLIENT_ID"];
  const secret = process.env[p === "google" ? "GOOGLE_CLIENT_SECRET" : "GITHUB_CLIENT_SECRET"];
  return id && secret ? { id, secret } : null;
}

export function enabledProviders() {
  return { google: Boolean(creds("google")), github: Boolean(creds("github")) };
}

export function isProvider(p: string): p is Provider {
  return p === "google" || p === "github";
}

function callbackUrl(req: NextRequest, p: Provider) {
  const base = process.env.DEMO_PUBLIC_URL?.replace(/\/+$/, "") || req.nextUrl.origin;
  return `${base}/api/auth/oauth/${p}/callback`;
}

function redirect(to: string, cookies: string[] = []): Response {
  const headers = new Headers({ location: to });
  for (const c of cookies) headers.append("set-cookie", c);
  return new Response(null, { status: 302, headers });
}

const secureFlag = process.env.NODE_ENV === "production" ? "; Secure" : "";

export function start(req: NextRequest, p: Provider): Response {
  const c = creds(p);
  if (!c) return redirect("/login?oauth_error=unavailable");
  const state = randomBytes(24).toString("base64url");
  const stateCookie = `${STATE_COOKIE}=${p}.${state}; Path=/; Max-Age=600; HttpOnly; SameSite=Lax${secureFlag}`;
  const q =
    p === "google"
      ? new URLSearchParams({ client_id: c.id, redirect_uri: callbackUrl(req, p), response_type: "code", scope: "openid email profile", state, prompt: "select_account" })
      : new URLSearchParams({ client_id: c.id, redirect_uri: callbackUrl(req, p), scope: "read:user user:email", state, allow_signup: "true" });
  const authorize = p === "google" ? "https://accounts.google.com/o/oauth2/v2/auth" : "https://github.com/login/oauth/authorize";
  return redirect(`${authorize}?${q}`, [stateCookie]);
}

async function profile(req: NextRequest, p: Provider, code: string): Promise<{ email: string; name: string }> {
  const c = creds(p);
  if (!c) throw new DemoAuthError(503, "unavailable");
  if (p === "google") {
    const tok = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: c.id, client_secret: c.secret, redirect_uri: callbackUrl(req, p), grant_type: "authorization_code" }),
    }).then((r) => r.json() as Promise<{ access_token?: string }>);
    if (!tok.access_token) throw new DemoAuthError(401, "failed");
    const info = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${tok.access_token}` } }).then(
      (r) => r.json() as Promise<{ email?: string; email_verified?: boolean; name?: string }>
    );
    if (!info.email || !info.email_verified) throw new DemoAuthError(400, "no_email");
    return { email: info.email, name: info.name ?? "" };
  }
  const tok = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ client_id: c.id, client_secret: c.secret, code, redirect_uri: callbackUrl(req, p) }),
  }).then((r) => r.json() as Promise<{ access_token?: string }>);
  if (!tok.access_token) throw new DemoAuthError(401, "failed");
  const gh = { authorization: `Bearer ${tok.access_token}`, accept: "application/vnd.github+json", "user-agent": "infrahub-demo" };
  const user = await fetch("https://api.github.com/user", { headers: gh }).then((r) => r.json() as Promise<{ login?: string; name?: string | null }>);
  const emails = await fetch("https://api.github.com/user/emails", { headers: gh }).then(
    (r) => r.json() as Promise<{ email: string; primary: boolean; verified: boolean }[]>
  );
  const email = Array.isArray(emails) ? (emails.find((e) => e.primary && e.verified) ?? emails.find((e) => e.verified))?.email : undefined;
  if (!email) throw new DemoAuthError(400, "no_email");
  return { email, name: user.name || user.login || "" };
}

export async function callback(req: NextRequest, p: Provider): Promise<Response> {
  const clearState = `${STATE_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secureFlag}`;
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state") ?? "";
  const saved = req.cookies.get(STATE_COOKIE)?.value ?? "";
  const expected = Buffer.from(`${p}.${state}`);
  const got = Buffer.from(saved);
  if (!code || !state || expected.length !== got.length || !timingSafeEqual(expected, got)) {
    return redirect("/login?oauth_error=failed", [clearState]);
  }
  try {
    const { email, name } = await profile(req, p, code);
    const user = await upsertOAuthUser(p, email, name);
    return redirect("/", [clearState, sessionCookieHeader(user)]);
  } catch (err) {
    const reason = err instanceof DemoAuthError && err.message === "no_email" ? "no_email" : "failed";
    if (!(err instanceof DemoAuthError)) console.error("oauth callback error", err);
    return redirect(`/login?oauth_error=${reason}`, [clearState]);
  }
}
