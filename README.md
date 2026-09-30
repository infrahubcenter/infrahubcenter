# Infra Hub Center: Live Demo

The public, explore-only demo of the Infra Hub Center console, at
**https://infrahubcentre.vercel.app**.

It is the real console UI with every screen working: Compute Inventory, Patch Management,
Host Metrics & Logs, Docker, Kubernetes, Database Observability, Object Storage (S3),
Alerting & Incidents, RBAC, Audit Trail and Settings. It runs entirely on **sample data**:

- No Infra Hub Center API is connected. Every read is answered in the browser from
  fictional sample infrastructure (`src/lib/demo/`), and the live views (metrics, logs,
  the VM console) stream generated frames.
- Any action that would change something (connecting an agent, adding a resource, running
  an operation, saving settings) opens an **"Install Infra Hub Center"** prompt instead.
- Sign-in is the only server-side part. Visitors create a demo account with email and
  password, or with Google or GitHub. Accounts are stored in the demo's own PostgreSQL
  database (`demo_users`), and the features they tried go to `demo_events`.

To run Infra Hub Center on your own infrastructure, see
https://infrahub-site.vercel.app/install.

## Configuration (Vercel project `infrahubcentre`)

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | The demo's own Postgres (Neon); set by the Vercel Neon integration |
| `DEMO_SESSION_SECRET` | Random string, at least 32 characters, used to sign demo sessions |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional: enables "Continue with Google" |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | Optional: enables "Continue with GitHub" |

OAuth callback URLs to register with each provider:

- Google: `https://infrahubcentre.vercel.app/api/auth/oauth/google/callback`
- GitHub: `https://infrahubcentre.vercel.app/api/auth/oauth/github/callback`

Tables are created automatically on the first sign-up.

## Development

```bash
npm install
npm run dev
```

Every push to `main` deploys to Vercel automatically.
