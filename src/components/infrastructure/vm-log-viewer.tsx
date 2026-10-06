"use client";

import { useEffect, useRef, useState } from "react";
import { ExpandToggleButton, ResizeHandle, useExpandablePanel } from "@/components/infrastructure/expandable-panel";
import { type VMAgentLogsInboundFrame, type LogSeverity } from "@/lib/api";
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

type ViewerState = "connecting" | "connected" | "error" | "closed";

type ViewerLine = { text: string; severity: LogSeverity; category?: string; suggestion?: string; receivedAt: string };

// Live-tail for the VM Agent's OS-level (journald) logs -- structural
// mirror of DockerLogViewer, just fed from vm-agent/logs/stream instead
// of a Docker container's stream. Live-only: nothing is stored server-side
// or in this component's own state beyond what's currently rendered.
const RECONNECT_DELAY_MS = 5000;

export function VMLogViewer({ streamUrl, vmName }: { streamUrl: string; vmName: string }) {
  const [state, setState] = useState<ViewerState>("connecting");
  const [message, setMessage] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const autoScrollRef = useRef(true);
  const { fullscreen, toggleFullscreen, contentStyle, contentClassName, panelClassName, resizeHandleProps } = useExpandablePanel(550);
  const [settings, updateSettings] = useLogSettings();
  const theme = settings.theme;
  // Pause and the refresh interval only change when lines are shown;
  // the stream itself stays connected.
  const buffer = useBufferedLines<ViewerLine>(settings.refresh);
  const { lines, push: pushLine, reset: resetLines } = buffer;
  const newestOnTop = settings.order === "top";
  // Bumping this re-runs the connect effect below: a dropped stream
  // reconnects by itself a few seconds later.
  const [reconnectNonce, setReconnectNonce] = useState(0);

  useEffect(() => {
    // Resets stale state from a previously viewed VM before opening the
    // new one's stream.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState("connecting");
    setMessage(null);
    resetLines();

    // See DockerLogViewer's identical guard for why this is needed:
    // React StrictMode (dev only, which is how this app is currently
    // being served) double-invokes this effect on mount, and the first
    // WebSocket's late, stale close event can otherwise land after the
    // second (real) connection has already opened, stomping "connected"
    // back to "closed" even though the live connection is fine.
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
      let frame: VMAgentLogsInboundFrame;
      try {
        frame = JSON.parse(ev.data as string) as VMAgentLogsInboundFrame;
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
            {state === "connected" && `Streaming logs from ${vmName}`}
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
