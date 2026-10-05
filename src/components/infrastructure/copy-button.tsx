"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Small "Copy" affordance for a command/token block -- shared by every
// agent install command reveal (VM Agent, Docker Agent, Docker Host,
// Kubernetes agent) so a long docker run/kubectl command never has to be
// hand-selected. Falls back to a manual-select hint if the Clipboard API
// itself is unavailable (non-HTTPS context, older browser) rather than
// silently doing nothing.
export function CopyButton({ value, className, label = "Copy" }: { value: string; className?: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const [unsupported, setUnsupported] = useState(false);

  async function handleCopy() {
    let ok = false;
    try {
      await navigator.clipboard.writeText(value);
      ok = true;
    } catch {
      // The Clipboard API only works on https (or localhost); a console
      // opened at http://<server-ip> copies through a hidden textarea.
      const ta = document.createElement("textarea");
      ta.value = value;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      ta.remove();
    }
    setUnsupported(!ok);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <Button type="button" variant="outline" size="sm" className={cn("gap-1", className)} onClick={handleCopy}>
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copied" : label}
      </Button>
      {unsupported && <span className="text-xs text-amber-600">Copy blocked by the browser. Select the text and copy it manually.</span>}
    </span>
  );
}

// A token or command in a box with its Copy button always visible in the
// header -- long commands scroll sideways inside the box instead of
// stretching the page and pushing the button out of view. `wrap` breaks a
// single long value (a token) onto several lines instead.
export function CommandBlock({
  value,
  label = "Command",
  wrap = false,
  className,
}: {
  value: string;
  label?: string;
  wrap?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 overflow-hidden rounded-lg border border-slate-800 bg-slate-950", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-slate-800 px-3 py-1">
        <span className="font-mono text-[11px] text-slate-400">{label}</span>
        <CopyButton
          value={value}
          className="h-6 border-slate-700 bg-slate-900 px-2 text-[11px] text-slate-200 hover:bg-slate-800 hover:text-white"
        />
      </div>
      <pre
        className={cn(
          "max-w-full p-3 font-mono text-xs leading-5 text-slate-100",
          wrap ? "whitespace-pre-wrap break-all" : "overflow-x-auto whitespace-pre"
        )}
      >
        {value}
      </pre>
    </div>
  );
}
