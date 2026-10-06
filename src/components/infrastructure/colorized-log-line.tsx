import { Fragment } from "react";

// Highlights the tokens inside one raw log line that most help a human
// scanning fast: HTTP-style status codes (200 green, 3xx sky, 4xx amber,
// 5xx red) and common level keywords (ERROR/FATAL red, WARN amber,
// SUCCESS/OK/INFO green-ish) -- independent of the line's own overall
// LogSeverity classification (that's a per-line badge; this is per-token
// within the line itself, e.g. a HEALTHY line that still mentions a 500
// somewhere in a stack trace).
const TOKEN_SOURCE =
  "(?<![\\d.:])(1\\d\\d|2\\d\\d|3\\d\\d|4\\d\\d|5\\d\\d)(?![\\d.:])|\\b(ERROR|FATAL|PANIC|CRITICAL)\\b|\\b(WARN|WARNING)\\b|\\b(SUCCESS|SUCCEEDED|OK|HEALTHY)\\b|\\b(INFO|DEBUG)\\b";

// Token colors per log background: brighter shades on black, deeper ones
// on white, so both stay readable.
const TOKEN_COLORS = {
  dark: { ok: "text-emerald-400", redirect: "text-sky-400", warn: "text-amber-400", bad: "text-red-400", info: "text-slate-400" },
  light: { ok: "text-emerald-700", redirect: "text-sky-700", warn: "text-amber-700", bad: "text-red-700", info: "text-slate-500" },
};

function classFor(match: string, theme: "dark" | "light"): string {
  const c = TOKEN_COLORS[theme];
  const upper = match.toUpperCase();
  if (/^[1-5]\d\d$/.test(match)) {
    const first = match[0];
    if (first === "2") return `${c.ok} font-semibold`;
    if (first === "3") return `${c.redirect} font-semibold`;
    if (first === "4") return `${c.warn} font-semibold`;
    return `${c.bad} font-semibold`; // 1xx/5xx
  }
  if (["ERROR", "FATAL", "PANIC", "CRITICAL"].includes(upper)) return `${c.bad} font-semibold`;
  if (["WARN", "WARNING"].includes(upper)) return `${c.warn} font-semibold`;
  if (["SUCCESS", "SUCCEEDED", "OK", "HEALTHY"].includes(upper)) return `${c.ok} font-semibold`;
  return c.info;
}

export function ColorizedLogLine({ text, theme = "dark" }: { text: string; theme?: "dark" | "light" }) {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let i = 0;
  // A fresh RegExp per call (rather than a shared module-level one) --
  // the `g` flag makes exec() stateful via .lastIndex, which must never
  // be a value shared across renders/instances.
  const pattern = new RegExp(TOKEN_SOURCE, "gi");
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(<Fragment key={i++}>{text.slice(lastIndex, match.index)}</Fragment>);
    }
    nodes.push(
      <span key={i++} className={classFor(match[0], theme)}>
        {match[0]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    nodes.push(<Fragment key={i++}>{text.slice(lastIndex)}</Fragment>);
  }
  return <>{nodes}</>;
}
