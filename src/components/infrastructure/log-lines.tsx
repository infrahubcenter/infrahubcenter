"use client";

import { useCallback, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { ColorizedLogLine } from "@/components/infrastructure/colorized-log-line";
import { LogSeverityBadge } from "@/components/infrastructure/log-severity-badge";
import { Button } from "@/components/ui/button";
import type { LogSeverity } from "@/lib/api";

// Shared look for every log view (Docker/Kubernetes/VM live logs and log
// history): a Dark (black) or Light (white) background the viewer picks
// once -- remembered in this browser and applied to all log panels -- and
// lines laid out as [time] [severity] [message] so they're easy to scan.

export type LogTheme = "dark" | "light";

const STORAGE_KEY = "infrahub:log-theme";
const CHANGE_EVENT = "infrahub:log-theme-change";

function readTheme(): LogTheme {
  try {
    return localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useLogTheme(): [LogTheme, () => void] {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "dark" as LogTheme);
  const toggle = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, readTheme() === "dark" ? "light" : "dark");
    } catch {
      // storage unavailable -- nothing to remember
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);
  return [theme, toggle];
}

export function LogThemeToggle({ theme, onToggle }: { theme: LogTheme; onToggle: () => void }) {
  const next = theme === "dark" ? "light" : "dark";
  return (
    <Button variant="outline" size="sm" onClick={onToggle} title={`Switch to a ${next} background`}>
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {theme === "dark" ? "Light" : "Dark"}
    </Button>
  );
}

// Classes for the scrolling box that holds the lines.
export function logBoxClass(theme: LogTheme): string {
  return theme === "dark"
    ? "rounded-lg border border-neutral-800 bg-black text-slate-100"
    : "rounded-lg border border-slate-200 bg-white text-slate-800";
}

export function logMutedClass(theme: LogTheme): string {
  return theme === "dark" ? "text-slate-500" : "text-slate-400";
}

const SEVERITY_BAR: Record<LogSeverity, string> = {
  HEALTHY: "border-l-emerald-500/60",
  WARNING: "border-l-amber-500/80",
  ERROR: "border-l-red-500/80",
  CRITICAL: "border-l-red-600",
};

// A leading container-runtime timestamp (RFC 3339, as Docker/Kubernetes
// prefix every line), and the same moment repeated by the app itself
// ("2026/10/06 05:03:23 ..."), which is dropped as noise.
const RUNTIME_TS = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2}))\s+/;
const APP_TS = /^(\d{4})[/-](\d{2})[/-](\d{2})[ T](\d{2}:\d{2}:\d{2})(?:[.,]\d+)?\s+/;

function splitTimestamp(text: string, loggedAt?: string): { at?: Date; message: string } {
  let message = text;
  let at = loggedAt ? new Date(loggedAt) : undefined;
  const rt = RUNTIME_TS.exec(message);
  if (rt) {
    const parsed = new Date(rt[1]);
    if (!Number.isNaN(parsed.getTime())) at ??= parsed;
    message = message.slice(rt[0].length);
  }
  const app = APP_TS.exec(message);
  if (app && at) {
    const iso = at.toISOString(); // UTC, like the runtime stamp
    if (`${app[1]}-${app[2]}-${app[3]}T${app[4]}` === iso.slice(0, 19)) message = message.slice(app[0].length);
  }
  return { at, message };
}

function shortTime(at: Date): string {
  const time = at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const today = new Date();
  const sameDay = at.toDateString() === today.toDateString();
  return sameDay ? time : `${at.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
}

export function LogLineRow({
  text,
  severity,
  suggestion,
  loggedAt,
  theme,
}: {
  text: string;
  severity: LogSeverity;
  suggestion?: string;
  loggedAt?: string;
  theme: LogTheme;
}) {
  const { at, message } = splitTimestamp(text, loggedAt);
  const dark = theme === "dark";
  return (
    <div
      className={`border-b border-l-2 py-1.5 pl-3 pr-2 last:border-b-0 ${SEVERITY_BAR[severity]} ${
        dark ? "border-b-white/[0.06] hover:bg-white/[0.04]" : "border-b-slate-100 hover:bg-slate-50"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`w-[4.75rem] shrink-0 whitespace-nowrap pt-px font-mono text-[11px] tabular-nums ${dark ? "text-slate-500" : "text-slate-400"}`}
          title={at ? `${at.toLocaleString()} (${at.toISOString()})` : undefined}
        >
          {at ? shortTime(at) : ""}
        </span>
        <span className="shrink-0 pt-px">
          <LogSeverityBadge severity={severity} />
        </span>
        <span className="min-w-0 flex-1 whitespace-pre-wrap font-mono text-[12.5px] leading-5 [overflow-wrap:anywhere]">
          <ColorizedLogLine text={message} theme={theme} />
        </span>
      </div>
      {suggestion && (
        <p className={`mt-1 pl-[calc(4.75rem+0.75rem)] text-[11.5px] ${dark ? "text-amber-300/90" : "text-amber-700"}`}>
          Suggested next step: {suggestion}
        </p>
      )}
    </div>
  );
}
