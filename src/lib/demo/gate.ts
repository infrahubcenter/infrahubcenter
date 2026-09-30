// "This is a demo" prompt: any action that would change something (connect
// an agent, add a resource, run an operation, save a setting) opens the
// install prompt instead -- see components/demo/demo-gate.tsx.

export const DEMO_BLOCKED_EVENT = "infrahub-demo-blocked";

export const DEMO_BLOCKED_MESSAGE =
  "This is the Infra Hub Center demo with sample data -- changes are disabled. Install Infra Hub Center to manage your own infrastructure.";

export type DemoBlockedDetail = { method: string; path: string };

// Describes what the visitor was trying to do, for the prompt's headline.
export function describeAction(path: string): string {
  if (/agent|connect|install|token/.test(path)) return "Connecting agents";
  if (/\/execute|\/reboot|\/operations|\/confirm|\/approve/.test(path)) return "Running operations";
  if (/\/users|\/access|\/members|\/permissions|access-grants/.test(path)) return "Managing team access";
  if (/alert-rules|notification-policies/.test(path)) return "Changing alerting";
  if (/settings|\/me\//.test(path)) return "Changing settings";
  if (/\/scan|\/discover|\/collect|\/refresh|\/test/.test(path)) return "Live scans and tests";
  return "Adding and changing resources";
}

export function notifyDemoBlocked(detail: DemoBlockedDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<DemoBlockedDetail>(DEMO_BLOCKED_EVENT, { detail }));
  // Best-effort interest signal for the demo's own sign-up database.
  void fetch("/api/demo/events", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: describeAction(detail.path), path: detail.path }),
    keepalive: true,
  }).catch(() => {});
}
