"use client";

import { useEffect, useRef, useState } from "react";
import { ExpandToggleButton, ResizeHandle, useExpandablePanel } from "@/components/infrastructure/expandable-panel";
import { type DockerLogsInboundFrame, type LogSeverity } from "@/lib/api";
import {
  LogDisplayControls,
  LogLineRow,
  LogRefreshControls,
  logBoxClass,
  logBoxStyle,
  logMutedClass,
  useBufferedLines,
  useLogSettings,
} from "@/components/infrastructure/log-lines";

// Left-border accent per severity -- lets a WARNING/ERROR/CRITICAL line
// stand out at a glance while scanning fast, on top of the badge and any
// in-line status-code/keyword highlighting (see LogLineRow in log-lines.tsx).
type ViewerState = "connecting" | "connected" | "error" | "closed";

type ViewerLine = { text: string; severity: LogSeverity; category?: string; suggestion?: string; receivedAt: string };

// Live-tail only (Step 24 decision): nothing is stored server-side or in
// this component's own state beyond what's currently rendered -- closing
// the tab loses history, matching how the Docker stats stream and VM
// Console already work in this app. Plain scrolling text, not a full
// terminal (unlike VM Console): log lines have no interactivity/keystroke
// input to preserve, so there's no reason for the xterm.js machinery here.
const RECONNECT_DELAY_MS = 5000;

export function DockerLogViewer({ streamUrl, containerName }: { streamUrl: string; containerName: string }) {
  const [state, setState] = useState<ViewerState>("connecting");
  const [message, setMessage] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const autoScrollRef = useRef(true);
  // Bumping this re-runs the connect effect below: a dropped stream
  // reconnects by itself a few seconds later.
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const { fullscreen, toggleFullscreen, contentStyle, contentClassName, panelClassName, resizeHandleProps } = useExpandablePanel(550);
  const [settings, updateSettings] = useLogSettings();
  const theme = settings.theme;
  // Pause and the refresh interval only change when lines are shown;
  // the stream itself stays connected.
  const buffer = useBufferedLines<ViewerLine>(settings.refresh);
  const { lines, push: pushLine, reset: resetLines } = buffer;
  const newestOnTop = settings.order === "top";

  useEffect(() => {
    // Resets stale state from the previously selected container (or an
    // automatic reconnect) before opening a fresh stream.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState("connecting");
    setMessage(null);
    resetLines();

    // Guards every handler below against a stale connection -- React
    // StrictMode (dev only) double-invokes this effect on mount: the
    // first WebSocket gets aborted by the immediately-following cleanup
    // before its handshake even finishes, but that abort's own close
    // event still arrives asynchronously, on the OLD closures, whenever
    // the browser gets around to it -- often AFTER the second (real)
    // connection has already opened. Without this flag, that late,
    // stale close event calls setState("closed") and stomps the correct
    // "connected" state right back to looking disconnected, even though
    // a real, live connection is sitting right there. Production
    // (`next build`/`next start`) never double-invokes effects, so this
    // exact race is invisible there -- but this app is currently being
    // served via `next dev`, where it fires close to every time.
    let cancelled = false;
    let failed = false;
    let retry: number | undefined;
    const ws = new WebSocket(streamUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (cancelled) return;
      setState("connected");
    };
    ws.onmessage = (ev) => {
      if (cancelled) return;
      let frame: DockerLogsInboundFrame;
      try {
        frame = JSON.parse(ev.data as string) as DockerLogsInboundFrame;
      } catch {
        return;
      }
      if (frame.type === "log") {
        const entry: ViewerLine = { text: frame.line, severity: frame.severity, category: frame.category, suggestion: frame.suggestion,
          receivedAt: new Date().toISOString(),
        };
        pushLine(entry);
      } else if (frame.type === "error") {
        failed = true;
        setState("error");
        setMessage(frame.message);
      } else if (frame.type === "closed") {
        setState("closed");
      }
    };
    ws.onclose = () => {
      if (cancelled) return;
      setState((prev) => (prev === "error" ? prev : "closed"));
      // Not for errors (no access, app gone): retrying wouldn't help.
      if (!failed) retry = window.setTimeout(() => setReconnectNonce((n) => n + 1), RECONNECT_DELAY_MS);
    };
    ws.onerror = () => {
      // No usable detail on this event by design -- onclose (which
      // always follows) is what actually updates state.
    };

    return () => {
      cancelled = true;
      window.clearTimeout(retry);
      ws.close();
      wsRef.current = null;
    };
  }, [streamUrl, reconnectNonce, resetLines, pushLine]);

  // Follow new lines -- at the bottom or the top, per the viewer's
  // order -- unless they've scrolled away to read something.
  useEffect(() => {
    const el = boxRef.current;
    if (el && autoScrollRef.current) el.scrollTop = newestOnTop ? 0 : el.scrollHeight;
  }, [lines, newestOnTop]);


  return (
    <div className={`flex flex-col gap-2 ${panelClassName}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <span
            className={`h-2 w-2 rounded-full ${
              state === "connected" ? "bg-emerald-500" : state === "connecting" ? "bg-amber-400" : "bg-slate-400"
            }`}
          />
          <span className="text-slate-600">
            {state === "connecting" && "Connecting…"}
            {state === "connected" && `Streaming logs from ${containerName}`}
            {state === "closed" && "Disconnected — reconnecting…"}
            {state === "error" && (message ?? "Connection error")}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LogRefreshControls buffer={buffer} refresh={settings.refresh} onRefreshChange={(refresh) => updateSettings({ refresh })} />
          <LogDisplayControls settings={settings} onChange={updateSettings} />
          <ExpandToggleButton fullscreen={fullscreen} onToggle={toggleFullscreen} />
        </div>
      </div>
      <div
        style={{ ...contentStyle, ...logBoxStyle(settings) }}
        className={`w-full overflow-y-auto py-1 ${logBoxClass(theme)} ${contentClassName}`}
        ref={boxRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          autoScrollRef.current = newestOnTop ? el.scrollTop < 40 : el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
      >
        {lines.length === 0 ? (
          <p className={`px-3 py-2 text-xs ${logMutedClass(theme)}`}>{state === "connected" ? "Waiting for log output…" : ""}</p>
        ) : (
          (newestOnTop ? [...lines].reverse() : lines).map((line, i) => (
            <LogLineRow key={i} text={line.text} severity={line.severity} suggestion={line.suggestion} receivedAt={line.receivedAt} theme={theme} />
          ))
        )}
      </div>
      <ResizeHandle hidden={fullscreen} {...resizeHandleProps} />
    </div>
  );
}
