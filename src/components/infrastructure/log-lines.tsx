"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { Minus, Moon, Pause, Play, Plus, Sun } from "lucide-react";
import { ColorizedLogLine } from "@/components/infrastructure/colorized-log-line";
import { LogSeverityBadge } from "@/components/infrastructure/log-severity-badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { LogSeverity } from "@/lib/api";

// Shared look for every log view (Docker/Kubernetes/VM live logs and log
// history): Dark (black) or Light (white) background, text size, font and
// (live views) how often new lines are shown. The viewer picks them once --
// remembered in this browser and applied to all log panels -- and lines are
// laid out as [date time] [severity] [message] so they're easy to scan.

export type LogTheme = "dark" | "light";

export const LOG_FONTS = [
  { id: "mono", label: "Monospace", stack: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace' },
  { id: "consolas", label: "Consolas", stack: 'Consolas, "Liberation Mono", monospace' },
  { id: "courier", label: "Courier New", stack: '"Courier New", Courier, monospace' },
  { id: "cascadia", label: "Cascadia Code", stack: '"Cascadia Code", "Cascadia Mono", Consolas, monospace' },
  { id: "lucida", label: "Lucida Console", stack: '"Lucida Console", Monaco, monospace' },
  { id: "arial", label: "Arial", stack: "Arial, Helvetica, sans-serif" },
  { id: "calibri", label: "Calibri", stack: "Calibri, Carlito, sans-serif" },
  { id: "segoe", label: "Segoe UI", stack: '"Segoe UI", system-ui, sans-serif' },
  { id: "verdana", label: "Verdana", stack: "Verdana, Geneva, sans-serif" },
  { id: "times", label: "Times New Roman", stack: '"Times New Roman", Times, serif' },
  { id: "georgia", label: "Georgia", stack: "Georgia, serif" },
] as const;

export type LogFont = (typeof LOG_FONTS)[number]["id"];

export const LOG_FONT_SIZES = [11, 12, 13, 14, 16, 18, 20, 24] as const;

// How often a live view shows newly arrived lines: "live" right away, or
// collected and shown together every N seconds.
export const LOG_REFRESH_OPTIONS = [
  { id: "live", label: "Live", ms: 0 },
  { id: "10s", label: "Every 10s", ms: 10_000 },
  { id: "30s", label: "Every 30s", ms: 30_000 },
  { id: "1m", label: "Every 1m", ms: 60_000 },
  { id: "5m", label: "Every 5m", ms: 300_000 },
  { id: "10m", label: "Every 10m", ms: 600_000 },
  { id: "15m", label: "Every 15m", ms: 900_000 },
  { id: "30m", label: "Every 30m", ms: 1_800_000 },
] as const;

export type LogRefresh = (typeof LOG_REFRESH_OPTIONS)[number]["id"];

export type LogSettings = { theme: LogTheme; size: number; font: LogFont; refresh: LogRefresh };

const KEYS = {
  theme: "infrahub:log-theme",
  size: "infrahub:log-font-size",
  font: "infrahub:log-font",
  refresh: "infrahub:log-refresh",
} as const;
const CHANGE_EVENT = "infrahub:log-theme-change";

const DEFAULTS: LogSettings = { theme: "dark", size: 13, font: "mono", refresh: "live" };

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

// useSyncExternalStore needs the same object back while nothing changed.
let cached: { raw: string; value: LogSettings } | null = null;

function readSettings(): LogSettings {
  const raw = [read(KEYS.theme), read(KEYS.size), read(KEYS.font), read(KEYS.refresh)];
  const joined = raw.join("|");
  if (cached?.raw === joined) return cached.value;
  const size = Number(raw[1]);
  const value: LogSettings = {
    theme: raw[0] === "light" ? "light" : "dark",
    size: (LOG_FONT_SIZES as readonly number[]).includes(size) ? size : DEFAULTS.size,
    font: LOG_FONTS.find((f) => f.id === raw[2])?.id ?? DEFAULTS.font,
    refresh: LOG_REFRESH_OPTIONS.find((r) => r.id === raw[3])?.id ?? DEFAULTS.refresh,
  };
  cached = { raw: joined, value };
  return value;
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useLogSettings(): [LogSettings, (patch: Partial<LogSettings>) => void] {
  const settings = useSyncExternalStore(subscribe, readSettings, () => DEFAULTS);
  const update = useCallback((patch: Partial<LogSettings>) => {
    try {
      for (const [k, v] of Object.entries(patch)) localStorage.setItem(KEYS[k as keyof LogSettings], String(v));
    } catch {
      // storage unavailable -- nothing to remember
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);
  return [settings, update];
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

// Text size (A- / A+), font and Light/Dark -- the same controls on every log panel.
export function LogDisplayControls({ settings, onChange }: { settings: LogSettings; onChange: (patch: Partial<LogSettings>) => void }) {
  const idx = LOG_FONT_SIZES.indexOf(settings.size as (typeof LOG_FONT_SIZES)[number]);
  return (
    <>
      <div className="flex items-center rounded-lg border border-input" role="group" aria-label="Log text size">
        <Button
          variant="ghost"
          size="sm"
          className="rounded-r-none px-2"
          onClick={() => onChange({ size: LOG_FONT_SIZES[Math.max(0, idx - 1)] })}
          disabled={idx <= 0}
          title="Smaller text"
        >
          <Minus className="h-3.5 w-3.5" />
          <span className="sr-only">Smaller text</span>
        </Button>
        <span className="min-w-[3.25rem] text-center text-xs tabular-nums text-slate-600" title="Log text size">
          {settings.size}px
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-l-none px-2"
          onClick={() => onChange({ size: LOG_FONT_SIZES[Math.min(LOG_FONT_SIZES.length - 1, idx + 1)] })}
          disabled={idx >= LOG_FONT_SIZES.length - 1}
          title="Larger text"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="sr-only">Larger text</span>
        </Button>
      </div>
      <Select value={settings.font} onValueChange={(v) => v && onChange({ font: v as LogFont })}>
        <SelectTrigger size="sm" className="w-44" title="Log font" aria-label="Log font">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LOG_FONTS.map((f) => (
            <SelectItem key={f.id} value={f.id}>
              <span style={{ fontFamily: f.stack }}>{f.label}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <LogThemeToggle theme={settings.theme} onToggle={() => onChange({ theme: settings.theme === "dark" ? "light" : "dark" })} />
    </>
  );
}

// Classes for the scrolling box that holds the lines.
export function logBoxClass(theme: LogTheme): string {
  return theme === "dark"
    ? "rounded-lg border border-neutral-800 bg-black text-slate-100"
    : "rounded-lg border border-slate-200 bg-white text-slate-800";
}

// Font and size for the box; rows size everything relative to it (em).
export function logBoxStyle(settings: LogSettings): CSSProperties {
  return { fontFamily: LOG_FONTS.find((f) => f.id === settings.font)?.stack, fontSize: `${settings.size}px` };
}

export function logMutedClass(theme: LogTheme): string {
  return theme === "dark" ? "text-slate-500" : "text-slate-400";
}

// Live lines with Pause and a refresh interval: arriving lines wait in a
// buffer and are shown right away ("live"), every N seconds, or -- while
// paused -- not until Resume. Both lists keep at most `cap` lines.
export function useBufferedLines<T>(refresh: LogRefresh, cap = 2000) {
  const [lines, setLines] = useState<T[]>([]);
  const [paused, setPaused] = useState(false);
  const [pending, setPending] = useState(0);
  const [secondsToNext, setSecondsToNext] = useState<number | null>(null);
  const bufferRef = useRef<T[]>([]);
  const nextAtRef = useRef<number | null>(null);
  const ms = LOG_REFRESH_OPTIONS.find((r) => r.id === refresh)?.ms ?? 0;
  const immediate = ms === 0 && !paused;
  const immediateRef = useRef(immediate);
  useEffect(() => {
    immediateRef.current = immediate;
  }, [immediate]);

  const flush = useCallback(() => {
    const buffered = bufferRef.current;
    bufferRef.current = [];
    setPending(0);
    if (buffered.length === 0) return;
    setLines((prev) => {
      const next = prev.concat(buffered);
      return next.length > cap ? next.slice(next.length - cap) : next;
    });
  }, [cap]);

  const push = useCallback(
    (line: T) => {
      if (immediateRef.current) {
        // Anything still held (e.g. Live picked in another tab) goes first.
        const held = bufferRef.current;
        bufferRef.current = [];
        setLines((prev) => {
          const next = held.length ? prev.concat(held, [line]) : [...prev, line];
          return next.length > cap ? next.slice(next.length - cap) : next;
        });
        return;
      }
      bufferRef.current.push(line);
      if (bufferRef.current.length > cap) bufferRef.current.splice(0, bufferRef.current.length - cap);
    },
    [cap]
  );

  const reset = useCallback(() => {
    bufferRef.current = [];
    setPending(0);
    setLines([]);
  }, []);

  // Interval mode: show the buffer every `ms`.
  useEffect(() => {
    if (paused || ms === 0) {
      nextAtRef.current = null;
      return;
    }
    nextAtRef.current = Date.now() + ms;
    const id = window.setInterval(() => {
      flush();
      nextAtRef.current = Date.now() + ms;
    }, ms);
    return () => window.clearInterval(id);
  }, [paused, ms, flush]);

  // While lines are held back, tick once a second for the waiting count
  // and the countdown (cheap -- the line list itself doesn't change).
  useEffect(() => {
    if (immediate) return;
    const id = window.setInterval(() => {
      setPending(bufferRef.current.length);
      const at = nextAtRef.current;
      setSecondsToNext(at === null ? null : Math.max(0, Math.ceil((at - Date.now()) / 1000)));
    }, 1000);
    return () => window.clearInterval(id);
  }, [immediate]);

  const pause = useCallback(() => setPaused(true), []);
  const resume = useCallback(() => {
    flush();
    setPaused(false);
  }, [flush]);

  return { lines, push, reset, flush, paused, pause, resume, pending, secondsToNext: paused || ms === 0 ? null : secondsToNext };
}

function formatCountdown(s: number): string {
  return s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s` : `${s}s`;
}

// Pause/Resume plus the refresh interval -- replaces a plain Disconnect.
export function LogRefreshControls({
  buffer,
  refresh,
  onRefreshChange,
}: {
  buffer: Pick<ReturnType<typeof useBufferedLines>, "flush" | "paused" | "pause" | "resume" | "pending" | "secondsToNext">;
  refresh: LogRefresh;
  onRefreshChange: (r: LogRefresh) => void;
}) {
  const { paused, pending, secondsToNext } = buffer;
  return (
    <>
      {paused ? (
        <Button variant="outline" size="sm" onClick={buffer.resume} title="Show held lines and keep streaming">
          <Play className="h-3.5 w-3.5" /> Resume
        </Button>
      ) : (
        <Button variant="outline" size="sm" onClick={buffer.pause} title="Hold new lines (the stream stays connected)">
          <Pause className="h-3.5 w-3.5" /> Pause
        </Button>
      )}
      <Select
        value={refresh}
        onValueChange={(v) => {
          if (!v) return;
          // Show what was collected so far, then continue at the new pace.
          buffer.flush();
          onRefreshChange(v as LogRefresh);
        }}
      >
        <SelectTrigger size="sm" className="w-32" title="How often new log lines are shown" aria-label="Refresh interval">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LOG_REFRESH_OPTIONS.map((r) => (
            <SelectItem key={r.id} value={r.id}>
              {r.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {(paused || refresh !== "live") && (
        <span className="text-xs tabular-nums text-slate-500">
          {pending} new line{pending === 1 ? "" : "s"} waiting
          {paused ? " · paused" : secondsToNext !== null ? ` · next in ${formatCountdown(secondsToNext)}` : ""}
        </span>
      )}
    </>
  );
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

function splitTimestamp(text: string, loggedAt?: string, receivedAt?: string): { at?: Date; message: string } {
  let message = text;
  let at = loggedAt ? new Date(loggedAt) : undefined;
  const rt = RUNTIME_TS.exec(message);
  if (rt) {
    const parsed = new Date(rt[1]);
    if (!Number.isNaN(parsed.getTime())) at ??= parsed;
    message = message.slice(rt[0].length);
  }
  // No stamp on the line itself: when it reached this page.
  if (!at && receivedAt) at = new Date(receivedAt);
  const app = APP_TS.exec(message);
  if (app && at) {
    const iso = at.toISOString(); // UTC, like the runtime stamp
    if (`${app[1]}-${app[2]}-${app[3]}T${app[4]}` === iso.slice(0, 19)) message = message.slice(app[0].length);
  }
  return { at, message };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "06 Oct 2026 11:08:03" in this browser's time zone.
function dateTime(at: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(at.getDate())} ${MONTHS[at.getMonth()]} ${at.getFullYear()} ${p(at.getHours())}:${p(at.getMinutes())}:${p(at.getSeconds())}`;
}

export function LogLineRow({
  text,
  severity,
  suggestion,
  loggedAt,
  receivedAt,
  theme,
}: {
  text: string;
  severity: LogSeverity;
  suggestion?: string;
  loggedAt?: string;
  receivedAt?: string;
  theme: LogTheme;
}) {
  const { at, message } = splitTimestamp(text, loggedAt, receivedAt);
  const dark = theme === "dark";
  return (
    <div
      className={`border-b border-l-2 py-1.5 pl-3 pr-2 last:border-b-0 ${SEVERITY_BAR[severity]} ${
        dark ? "border-b-white/[0.06] hover:bg-white/[0.04]" : "border-b-slate-100 hover:bg-slate-50"
      }`}
    >
      <div className="flex items-start gap-3 leading-[1.55]">
        <span
          className={`w-[10.5em] shrink-0 whitespace-nowrap text-[0.85em] leading-[1.82] tabular-nums ${dark ? "text-slate-500" : "text-slate-400"}`}
          title={at ? `${at.toLocaleString()} (${at.toISOString()})` : undefined}
        >
          {at ? dateTime(at) : ""}
        </span>
        <span className="shrink-0 pt-[0.15em]">
          <LogSeverityBadge severity={severity} />
        </span>
        <span className="min-w-0 flex-1 whitespace-pre-wrap [overflow-wrap:anywhere]">
          <ColorizedLogLine text={message} theme={theme} />
        </span>
      </div>
      {suggestion && (
        <p className={`mt-1 pl-[calc(9.92em+0.75rem)] text-[0.9em] ${dark ? "text-amber-300/90" : "text-amber-700"}`}>
          Suggested next step: {suggestion}
        </p>
      )}
    </div>
  );
}
