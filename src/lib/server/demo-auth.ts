// Server-only: the demo's own accounts, stored in its separate Postgres
// (DATABASE_URL, Neon on Vercel). Nothing here ever reaches a real Infra
// Hub Center API -- this database only records who signed up for the demo
// and which features they tried.

import "server-only";
import { createHmac, randomBytes, randomUUID, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { neon } from "@neondatabase/serverless";
import type { NextRequest } from "next/server";

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

export const SESSION_COOKIE = "infrahub_demo_session";
const SESSION_DAYS = 7;

export type DemoUser = { id: string; name: string; email: string; role: "OWNER" };

export class DemoAuthError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new DemoAuthError(503, "Demo sign-up is not configured yet.");
  return neon(url);
}

let schemaReady: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  schemaReady ??= (async () => {
    const db = sql();
    await db`CREATE TABLE IF NOT EXISTS demo_users (
      id uuid PRIMARY KEY,
      name text NOT NULL,
      email text NOT NULL UNIQUE,
      company text,
      password_hash text,
      auth_provider text NOT NULL DEFAULT 'password',
      created_at timestamptz NOT NULL DEFAULT now(),
      last_login_at timestamptz,
      login_count integer NOT NULL DEFAULT 0
    )`;
    await db`CREATE TABLE IF NOT EXISTS demo_events (
      id bigserial PRIMARY KEY,
      user_id uuid REFERENCES demo_users(id) ON DELETE CASCADE,
      action text NOT NULL,
      path text,
      created_at timestamptz NOT NULL DEFAULT now()
    )`;
  })().catch((err) => {
    schemaReady = null;
    throw err;
  });
  return schemaReady;
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltB64, keyB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length);
  return timingSafeEqual(actual, expected);
}

function secret(): string {
  const s = process.env.DEMO_SESSION_SECRET;
  if (!s || s.length < 32) throw new DemoAuthError(503, "Demo sign-in is not configured yet.");
  return s;
}

// Session token: base64url(json).base64url(hmac) -- stateless, 7 days.
export function signSession(user: DemoUser): string {
  const payload = Buffer.from(JSON.stringify({ ...user, exp: Date.now() + SESSION_DAYS * 86_400_000 })).toString("base64url");
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function readSession(req: NextRequest): DemoUser | null {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as DemoUser & { exp: number };
    if (data.exp < Date.now()) return null;
    return { id: data.id, name: data.name, email: data.email, role: "OWNER" };
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_DAYS * 86_400,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function registerUser(input: { name?: unknown; email?: unknown; company?: unknown; password?: unknown }): Promise<DemoUser> {
  const name = typeof input.name === "string" ? input.name.trim().slice(0, 100) : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase().slice(0, 200) : "";
  const company = typeof input.company === "string" ? input.company.trim().slice(0, 150) : "";
  const password = typeof input.password === "string" ? input.password : "";
  if (!name) throw new DemoAuthError(400, "Please enter your name.");
  if (!EMAIL_RE.test(email)) throw new DemoAuthError(400, "Please enter a valid email address.");
  if (password.length < 8 || password.length > 200) throw new DemoAuthError(400, "Use a password of at least 8 characters.");
  await ensureSchema();
  const db = sql();
  const existing = await db`SELECT id FROM demo_users WHERE email = ${email}`;
  if (existing.length > 0) throw new DemoAuthError(409, "An account with this email already exists. Sign in instead.");
  const id = randomUUID();
  await db`INSERT INTO demo_users (id, name, email, company, password_hash, last_login_at, login_count)
           VALUES (${id}, ${name}, ${email}, ${company || null}, ${await hashPassword(password)}, now(), 1)`;
  return { id, name, email, role: "OWNER" };
}

export async function loginUser(input: { email?: unknown; password?: unknown }): Promise<DemoUser> {
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const password = typeof input.password === "string" ? input.password : "";
  await ensureSchema();
  const db = sql();
  const rows = (await db`SELECT id, name, email, password_hash FROM demo_users WHERE email = ${email}`) as {
    id: string;
    name: string;
    email: string;
    password_hash: string | null;
  }[];
  const row = rows[0];
  if (!row || !row.password_hash || !(await verifyPassword(password, row.password_hash))) {
    throw new DemoAuthError(401, "Invalid email or password.");
  }
  await db`UPDATE demo_users SET last_login_at = now(), login_count = login_count + 1 WHERE id = ${row.id}`;
  return { id: row.id, name: row.name, email: row.email, role: "OWNER" };
}

// Google/GitHub sign-in: the provider already verified the email, so an
// existing account with that email simply signs in; otherwise one is made.
export async function upsertOAuthUser(provider: "google" | "github", email: string, name: string): Promise<DemoUser> {
  const cleanEmail = email.trim().toLowerCase().slice(0, 200);
  const cleanName = (name || cleanEmail.split("@")[0]).trim().slice(0, 100);
  if (!EMAIL_RE.test(cleanEmail)) throw new DemoAuthError(400, "Your account has no verified email address.");
  await ensureSchema();
  const db = sql();
  const rows = (await db`SELECT id, name FROM demo_users WHERE email = ${cleanEmail}`) as { id: string; name: string }[];
  if (rows[0]) {
    await db`UPDATE demo_users SET last_login_at = now(), login_count = login_count + 1 WHERE id = ${rows[0].id}`;
    return { id: rows[0].id, name: rows[0].name, email: cleanEmail, role: "OWNER" };
  }
  const id = randomUUID();
  await db`INSERT INTO demo_users (id, name, email, auth_provider, last_login_at, login_count)
           VALUES (${id}, ${cleanName}, ${cleanEmail}, ${provider}, now(), 1)`;
  return { id, name: cleanName, email: cleanEmail, role: "OWNER" };
}

export function sessionCookieHeader(user: DemoUser): string {
  const o = sessionCookieOptions;
  return `${SESSION_COOKIE}=${signSession(user)}; Path=${o.path}; Max-Age=${o.maxAge}; HttpOnly; SameSite=Lax${o.secure ? "; Secure" : ""}`;
}

export async function recordEvent(userId: string, action: string, path: string) {
  await ensureSchema();
  await sql()`INSERT INTO demo_events (user_id, action, path) VALUES (${userId}, ${action.slice(0, 100)}, ${path.slice(0, 300)})`;
}

export function errorResponse(err: unknown): Response {
  if (err instanceof DemoAuthError) return Response.json({ error: err.message }, { status: err.status });
  console.error("demo auth error", err);
  return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
