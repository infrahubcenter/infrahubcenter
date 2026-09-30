// Stand-in for the browser WebSocket on the console's live views (metrics,
// logs, the VM console, operation logs). Frames are generated from the same
// sample data the REST mocks use, so charts and log tails keep moving.

import { alerts, containerSetFor, dockerHostIndex, vmContainerIndex, vmContainers } from "./data";
import { databaseMetricsFrame, databasePerformance, dockerMetric, sampleLogLine, vmAgentMetrics } from "./routes";

type Listener = (ev: Event) => void;

function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

const CONSOLE_BANNER =
  "\r\n\x1b[1;36mInfra Hub Center demo console\x1b[0m\r\n" +
  "This terminal is a preview. Install Infra Hub Center to open real SSH\r\n" +
  "sessions to your servers right from the browser.\r\n\r\n" +
  "\x1b[32mubuntu@prod-web-01\x1b[0m:\x1b[34m~\x1b[0m$ ";

export class DemoWebSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;

  readonly url: string;
  readyState = 0;
  protocol = "";
  extensions = "";
  binaryType: BinaryType = "blob";
  bufferedAmount = 0;
  onopen: Listener | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onerror: Listener | null = null;

  private timers: ReturnType<typeof setTimeout>[] = [];
  private tick = 0;
  private line = "";

  constructor(url: string | URL) {
    super();
    this.url = String(url);
    this.later(150, () => {
      this.readyState = 1;
      const ev = new Event("open");
      this.onopen?.(ev);
      this.dispatchEvent(ev);
      this.start();
    });
  }

  private later(ms: number, fn: () => void) {
    this.timers.push(setTimeout(fn, ms));
  }

  private every(ms: number, fn: () => void) {
    this.timers.push(setInterval(fn, ms));
  }

  private emit(data: unknown) {
    if (this.readyState !== 1) return;
    const ev = new MessageEvent("message", { data: JSON.stringify(data) });
    this.onmessage?.(ev);
    this.dispatchEvent(ev);
  }

  private start() {
    const path = new URL(this.url, "http://demo.local").pathname;
    const seg = path.split("/");
    let m: RegExpMatchArray | null;

    if ((m = path.match(/\/api\/vms\/([^/]+)\/console$/))) {
      this.emit({ type: "output", data: utf8ToBase64(CONSOLE_BANNER) });
      return;
    }
    if ((m = path.match(/\/api\/vms\/([^/]+)\/vm-agent\/metrics\/stream$/))) {
      const id = m[1];
      this.emit(vmAgentMetrics(id));
      this.every(5000, () => this.emit(vmAgentMetrics(id)));
      return;
    }
    if ((m = path.match(/\/api\/vms\/([^/]+)\/docker\/containers\/([^/]+)\/stats\/stream$/))) {
      const vmId = m[1];
      const cid = m[2];
      const idx = vmContainerIndex(vmId);
      const ci = Math.max(0, vmContainers(vmId).findIndex((c) => c.id === cid));
      const send = () => this.emit({ ...dockerMetric(idx, ci), container_id: cid });
      send();
      this.every(3000, send);
      return;
    }
    if ((m = path.match(/\/api\/databases\/([^/]+)\/metrics\/stream$/))) {
      const id = m[1];
      this.emit(databaseMetricsFrame(id));
      this.every(5000, () => this.emit(databaseMetricsFrame(id)));
      return;
    }
    if ((m = path.match(/\/api\/databases\/([^/]+)\/performance\/stream$/))) {
      const id = m[1];
      this.emit(databasePerformance(id));
      this.every(10000, () => this.emit(databasePerformance(id)));
      return;
    }
    if (path.endsWith("/api/alerts/stream")) {
      const send = () => this.emit({ type: "alerts", alerts: alerts().filter((a) => a.status === "ACTIVE") });
      send();
      this.every(15000, send);
      return;
    }
    if (path.endsWith("/logs/stream")) {
      if (/operations\//.test(path)) {
        this.later(300, () => this.emit({ type: "done", status: "SUCCESS" }));
        return;
      }
      const seed = seg.join("").length + (path.includes("/docker/hosts/") ? dockerHostIndex(seg[4] ?? "") : 0);
      const send = () => {
        const l = sampleLogLine(seed + this.tick++ * 5);
        this.emit({ type: "log", line: `${new Date().toISOString()} ${l.line}`, severity: l.severity, category: l.category, suggestion: l.suggestion });
      };
      for (let i = 0; i < 5; i++) send();
      this.every(2500, send);
      return;
    }
    if (path.endsWith("/install-stream")) {
      this.later(200, () => this.emit({ type: "line", line: "Install Infra Hub Center to install agents on your own servers." }));
      this.later(400, () => this.emit({ type: "done", status: "failed", message: "Not available in the demo" }));
      return;
    }
    // Unknown stream: stay open and quiet.
    void containerSetFor;
  }

  send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
    // VM console keystrokes: echo them back, and answer Enter with a hint.
    if (typeof data !== "string" || !/\/console$/.test(new URL(this.url, "http://demo.local").pathname)) return;
    let frame: { type?: string; data?: string };
    try {
      frame = JSON.parse(data);
    } catch {
      return;
    }
    if (frame.type !== "input" || !frame.data) return;
    let text: string;
    try {
      text = new TextDecoder().decode(Uint8Array.from(atob(frame.data), (c) => c.charCodeAt(0)));
    } catch {
      text = frame.data;
    }
    let out = "";
    for (const ch of text) {
      if (ch === "\r" || ch === "\n") {
        const cmd = this.line.trim();
        this.line = "";
        out += "\r\n";
        if (cmd) out += `${cmd.split(" ")[0]}: available after you install Infra Hub Center on your own infrastructure.\r\n`;
        out += "\x1b[32mubuntu@prod-web-01\x1b[0m:\x1b[34m~\x1b[0m$ ";
      } else if (ch === "\x7f") {
        if (this.line) {
          this.line = this.line.slice(0, -1);
          out += "\b \b";
        }
      } else if (ch >= " ") {
        this.line += ch;
        out += ch;
      }
    }
    if (out) this.emit({ type: "output", data: utf8ToBase64(out) });
  }

  close() {
    if (this.readyState >= 2) return;
    for (const t of this.timers) {
      clearTimeout(t);
      clearInterval(t);
    }
    this.readyState = 3;
    const ev = new CloseEvent("close", { code: 1000, wasClean: true });
    this.onclose?.(ev);
    this.dispatchEvent(ev);
  }
}

// Swap in the demo socket for the console's own /api streams only.
export function installDemoWebSocket() {
  if (typeof window === "undefined") return;
  const w = window as unknown as { WebSocket: typeof WebSocket; __demoWsInstalled?: boolean };
  if (w.__demoWsInstalled) return;
  w.__demoWsInstalled = true;
  const Real = w.WebSocket;
  const Patched = function (this: unknown, url: string | URL, protocols?: string | string[]) {
    if (String(url).includes("/api/")) return new DemoWebSocket(url);
    return new Real(url, protocols);
  } as unknown as typeof WebSocket;
  Object.assign(Patched, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
  w.WebSocket = Patched;
}
