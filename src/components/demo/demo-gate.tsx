"use client";

import { useEffect, useState } from "react";
import { Boxes, Container, Database, HardDrive, Rocket, Server, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEMO_BLOCKED_EVENT, describeAction, type DemoBlockedDetail } from "@/lib/demo/gate";
import { installDemoWebSocket } from "@/lib/demo/fake-ws";

export const SITE_URL = "https://infrahub-site.vercel.app";
export const INSTALL_URL = `${SITE_URL}/install`;

// Mounted once in the root layout: swaps in the demo's live streams and
// shows the install prompt whenever a visitor tries to change something.
export function DemoGate() {
  const [detail, setDetail] = useState<DemoBlockedDetail | null>(null);

  useEffect(() => {
    installDemoWebSocket();
    const onBlocked = (e: Event) => setDetail((e as CustomEvent<DemoBlockedDetail>).detail);
    window.addEventListener(DEMO_BLOCKED_EVENT, onBlocked);
    return () => window.removeEventListener(DEMO_BLOCKED_EVENT, onBlocked);
  }, []);

  useEffect(() => {
    if (!detail) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDetail(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detail]);

  if (!detail) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-gate-title"
      onClick={() => setDetail(null)}
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 px-6 py-5 text-white">
          <button
            type="button"
            onClick={() => setDetail(null)}
            className="absolute right-3 top-3 rounded-md p-1 text-white/80 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-white/80">
            <Sparkles className="h-3.5 w-3.5" /> Demo mode
          </div>
          <h2 id="demo-gate-title" className="mt-1 text-xl font-semibold">
            {describeAction(detail.path)} needs your own Infra Hub Center
          </h2>
          <p className="mt-1 text-sm text-white/85">
            You&apos;re exploring a live preview with sample data. Install Infra Hub Center on your own infrastructure to
            connect real agents and manage everything from one place.
          </p>
        </div>

        <div className="px-6 py-5">
          <ul className="grid grid-cols-1 gap-2.5 text-sm text-foreground sm:grid-cols-2">
            <li className="flex items-center gap-2"><Server className="h-4 w-4 text-blue-600" /> VMs &amp; hosts: metrics, logs, SSH console</li>
            <li className="flex items-center gap-2"><Container className="h-4 w-4 text-blue-600" /> Docker hosts &amp; containers</li>
            <li className="flex items-center gap-2"><Boxes className="h-4 w-4 text-blue-600" /> Kubernetes clusters &amp; pods</li>
            <li className="flex items-center gap-2"><Database className="h-4 w-4 text-blue-600" /> Databases &amp; performance</li>
            <li className="flex items-center gap-2"><HardDrive className="h-4 w-4 text-blue-600" /> S3 object storage</li>
            <li className="flex items-center gap-2"><Rocket className="h-4 w-4 text-blue-600" /> Patching, alerts &amp; RBAC</li>
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            Runs with Docker, on a Linux host (apt/dnf/yum/zypper) or on Kubernetes, in a few minutes. Free plan available.
          </p>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setDetail(null)}>
              Keep exploring
            </Button>
            <Button variant="outline" render={<a href={`${SITE_URL}/#pricing`} target="_blank" rel="noreferrer" />}>
              See pricing
            </Button>
            <Button render={<a href={INSTALL_URL} target="_blank" rel="noreferrer" />}>Install Infra Hub Center</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Slim strip above the console header, on every signed-in page.
export function DemoBanner() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-1.5 text-center text-xs text-white sm:text-sm">
      <span>
        <strong className="font-semibold">Demo</strong> &middot; You&apos;re exploring Infra Hub Center with sample data.
      </span>
      <a href={INSTALL_URL} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2 hover:text-white/90">
        Install it for your infrastructure &rarr;
      </a>
    </div>
  );
}
