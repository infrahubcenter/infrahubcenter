"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ApiError,
  createAlertRule,
  listMonitoringDashboards,
  listNotificationPolicies,
  updateAlertRule,
  type AlertRuleListItem,
  type AlertSeverity,
  type LogDashboardMatchOptions,
  type MonitoringDashboard,
  type NotificationPolicy,
} from "@/lib/api";

// Alert rules set on a whole Docker or Kubernetes log dashboard: every
// app/container the dashboard shows is watched, with one alert (and one
// notification) per app/container that matches. Used from Alerts > Alert
// Rules and from a log dashboard's own "Create alert" button.

export type LogKind = "K8S" | "DOCKER";
type RuleKind = "K8S_LOGS_POD_PROBLEM" | "K8S_LOGS_ERROR_LINES" | "DOCKER_LOGS_CONTAINER_EXITED" | "DOCKER_LOGS_ERROR_LINES";

export const K8S_PROBLEM_CHOICES: { value: string; label: string }[] = [
  { value: "IMAGE_PULL", label: "Image pull failed (ImagePullBackOff, ErrImagePull)" },
  { value: "CRASH_LOOP", label: "Crash loop (CrashLoopBackOff)" },
  { value: "OOM_KILLED", label: "Out of memory (OOMKilled)" },
  { value: "RESTARTED", label: "Container restarted" },
  { value: "CONTAINER_FAILED", label: "Container exited with an error" },
  { value: "CONFIG_ERROR", label: "Config or start error (CreateContainerConfigError, RunContainerError)" },
  { value: "ACCESS_DENIED", label: "Access denied (Forbidden, Unauthorized, pull access denied)" },
  { value: "SCHEDULING", label: "Can't be scheduled (FailedScheduling, Unschedulable)" },
  { value: "VOLUME_MOUNT", label: "Volume mount failed (FailedMount)" },
  { value: "PROBE_FAILED", label: "Health probe failed (liveness/readiness Unhealthy)" },
  { value: "OTHER_WARNING", label: "Any other Kubernetes warning event" },
];

export const LOG_CATEGORY_CHOICES: { value: string; label: string }[] = [
  { value: "SUSPICIOUS_ACTIVITY", label: "Suspicious activity (attack probes, injection, scanners)" },
  { value: "AUTH_SECURITY", label: "Auth failures / access denied (401, 403, forbidden)" },
  { value: "CRASH", label: "Crash, panic or fatal error" },
  { value: "OUT_OF_MEMORY", label: "Out of memory" },
  { value: "HTTP_5XX_UNAVAILABLE", label: "502 / 503 / 504 (upstream down)" },
  { value: "HTTP_5XX_INTERNAL", label: "500 Internal Server Error" },
  { value: "EXCEPTION", label: "Exceptions and tracebacks" },
  { value: "CONNECTIVITY", label: "Connection failures" },
  { value: "TIMEOUT", label: "Timeouts" },
  { value: "RATE_LIMITED", label: "Rate limited (429)" },
  { value: "HTTP_404_NOT_FOUND", label: "404 Not Found" },
  { value: "HTTP_4XX_CLIENT", label: "Other 4xx client errors" },
  { value: "GENERIC_ERROR", label: "Any other line with \"error\" or \"failed\"" },
  { value: "GENERIC_WARNING", label: "Warnings" },
];

const SEVERITIES: AlertSeverity[] = ["INFO", "WARNING", "CRITICAL"];
const DEFAULT_POLICY = "__default__";

const RULE_INFO: Record<RuleKind, { title: string; hint: string; severity: AlertSeverity; window: number; threshold: number }> = {
  K8S_LOGS_POD_PROBLEM: {
    title: "Kubernetes pod problems",
    hint: "What Kubernetes reports about a pod: image pull errors, crash loops, OOM kills, restarts, access denied and other warning events. The alert includes the events and, after a crash, the last log lines of the container that stopped.",
    severity: "CRITICAL",
    window: 10,
    threshold: 1,
  },
  K8S_LOGS_ERROR_LINES: {
    title: "Errors or suspicious activity in pod logs",
    hint: "Log lines from the pods' own output, counted over a time window.",
    severity: "WARNING",
    window: 5,
    threshold: 1,
  },
  DOCKER_LOGS_CONTAINER_EXITED: {
    title: "Container stopped",
    hint: "A container stops or exits. The alert includes its exit code and the last log lines it wrote before stopping.",
    severity: "CRITICAL",
    window: 0,
    threshold: 1,
  },
  DOCKER_LOGS_ERROR_LINES: {
    title: "Errors or suspicious activity in container logs",
    hint: "Log lines from the containers' own output, counted over a time window.",
    severity: "WARNING",
    window: 5,
    threshold: 1,
  },
};

const RULES_FOR: Record<LogKind, RuleKind[]> = {
  K8S: ["K8S_LOGS_POD_PROBLEM", "K8S_LOGS_ERROR_LINES"],
  DOCKER: ["DOCKER_LOGS_CONTAINER_EXITED", "DOCKER_LOGS_ERROR_LINES"],
};

type RuleSettings = {
  on: boolean;
  severity: AlertSeverity;
  windowMinutes: string;
  threshold: string;
  problems: string[];
  anyError: boolean;
  categories: string[];
  onlyUnexpected: boolean;
};

function defaultSettings(kind: RuleKind, on: boolean): RuleSettings {
  const info = RULE_INFO[kind];
  return {
    on,
    severity: info.severity,
    windowMinutes: String(info.window),
    threshold: String(info.threshold),
    problems: K8S_PROBLEM_CHOICES.map((c) => c.value),
    anyError: true,
    categories: ["SUSPICIOUS_ACTIVITY", "AUTH_SECURITY"],
    onlyUnexpected: false,
  };
}

function settingsFromRule(item: AlertRuleListItem): RuleSettings {
  const kind = item.rule.alert_type as RuleKind;
  const opts = item.rule.match_options ?? {};
  const base = defaultSettings(kind, true);
  return {
    ...base,
    severity: item.rule.severity,
    windowMinutes: String(Math.round(item.rule.duration_seconds / 60)),
    threshold: String(item.rule.threshold),
    problems: opts.k8s_problems && opts.k8s_problems.length > 0 ? opts.k8s_problems : base.problems,
    anyError: !opts.log_categories || opts.log_categories.length === 0,
    categories: opts.log_categories && opts.log_categories.length > 0 ? opts.log_categories : base.categories,
    onlyUnexpected: opts.only_unexpected_exits ?? false,
  };
}

function toggle(list: string[], value: string, on: boolean): string[] {
  return on ? [...new Set([...list, value])] : list.filter((v) => v !== value);
}

type FolderGroup = { key: string; name: string; workspace: string; dashboards: MonitoringDashboard[] };

// Dashboards grouped by their folder (workspace shown alongside, since
// folder names can repeat across workspaces).
function groupByFolder(dashboards: MonitoringDashboard[]): FolderGroup[] {
  const groups = new Map<string, FolderGroup>();
  for (const d of dashboards) {
    const key = d.monitoring_folder_id ?? `none:${d.workspace_id}`;
    const g = groups.get(key) ?? { key, name: d.folder_name ?? "No folder", workspace: d.workspace_name, dashboards: [] };
    g.dashboards.push(d);
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => a.workspace.localeCompare(b.workspace) || a.name.localeCompare(b.name));
}

export function LogDashboardAlertRuleForm({
  dashboard,
  existing,
  logKind: initialLogKind,
  embedded,
  onSaved,
  onCancel,
}: {
  // Locks the form to one dashboard (its own "Create alert" button).
  dashboard?: Pick<MonitoringDashboard, "id" | "name" | "feature">;
  // Edit one existing log-dashboard rule.
  existing?: AlertRuleListItem;
  // Docker or Kubernetes Log Explorer, when already chosen by the caller
  // (New Rule's Log Management section).
  logKind?: LogKind;
  // Inside another card (New Rule) -- no border or heading of its own.
  embedded?: boolean;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const editing = Boolean(existing);
  const lockedFeature = existing?.monitoring_dashboard_feature ?? dashboard?.feature;
  const logKind: LogKind = initialLogKind ?? (lockedFeature === "DOCKER_LOGS" ? "DOCKER" : "K8S");
  const [dashboards, setDashboards] = useState<MonitoringDashboard[] | null>(null);
  const fixedDashboardId = existing?.rule.monitoring_dashboard_id ?? dashboard?.id;
  const [selectedDashboards, setSelectedDashboards] = useState<string[]>(fixedDashboardId ? [fixedDashboardId] : []);
  const [policies, setPolicies] = useState<NotificationPolicy[]>([]);
  const [policyId, setPolicyId] = useState(existing?.rule.notification_policy_id ?? "");
  const [logLines, setLogLines] = useState(String(existing?.rule.match_options?.log_lines ?? 20));
  const [enabled, setEnabled] = useState(existing?.rule.enabled ?? true);
  const [settings, setSettings] = useState<Record<RuleKind, RuleSettings>>(() => {
    const all = {} as Record<RuleKind, RuleSettings>;
    for (const kind of Object.keys(RULE_INFO) as RuleKind[]) {
      all[kind] = existing && existing.rule.alert_type === kind ? settingsFromRule(existing) : defaultSettings(kind, !existing);
    }
    return all;
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listNotificationPolicies()
      .then((r) => setPolicies(r.notification_policies))
      .catch(() => setPolicies([]));
  }, []);

  useEffect(() => {
    if (fixedDashboardId) return;
    listMonitoringDashboards(logKind === "K8S" ? "K8S_LOGS" : "DOCKER_LOGS")
      .then((r) => setDashboards(r.dashboards))
      .catch(() => setDashboards([]));
  }, [logKind, fixedDashboardId]);

  const folders = useMemo(() => groupByFolder(dashboards ?? []), [dashboards]);

  function toggleFolder(g: FolderGroup, on: boolean) {
    const ids = g.dashboards.map((d) => d.id);
    setSelectedDashboards((cur) => (on ? [...new Set([...cur, ...ids])] : cur.filter((id) => !ids.includes(id))));
  }

  const kinds = useMemo(
    () => (existing ? [existing.rule.alert_type as RuleKind] : RULES_FOR[logKind]),
    [existing, logKind]
  );
  const dashboardName = existing?.monitoring_dashboard_name ?? dashboard?.name;

  function update(kind: RuleKind, patch: Partial<RuleSettings>) {
    setSettings((s) => ({ ...s, [kind]: { ...s[kind], ...patch } }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (selectedDashboards.length === 0) {
      setError("Pick at least one log dashboard.");
      return;
    }
    const chosen = kinds.filter((k) => settings[k].on);
    if (chosen.length === 0) {
      setError("Pick at least one thing to alert on.");
      return;
    }
    const lines = Number(logLines);
    if (!Number.isInteger(lines) || lines < 0 || lines > 100) {
      setError("Log lines to include must be between 0 and 100.");
      return;
    }
    const payloads = [];
    for (const kind of chosen) {
      const s = settings[kind];
      const windowMinutes = Number(s.windowMinutes);
      const threshold = Number(s.threshold);
      if (kind !== "DOCKER_LOGS_CONTAINER_EXITED" && (!Number.isFinite(windowMinutes) || windowMinutes < 1 || windowMinutes > 1440)) {
        setError(`${RULE_INFO[kind].title}: the time window must be 1 to 1440 minutes.`);
        return;
      }
      if (kind.endsWith("_ERROR_LINES") && (!Number.isInteger(threshold) || threshold < 1)) {
        setError(`${RULE_INFO[kind].title}: the number of lines must be 1 or more.`);
        return;
      }
      if (kind === "K8S_LOGS_POD_PROBLEM" && s.problems.length === 0) {
        setError("Pick at least one pod problem.");
        return;
      }
      if (kind.endsWith("_ERROR_LINES") && !s.anyError && s.categories.length === 0) {
        setError("Pick at least one log category, or choose any error line.");
        return;
      }
      const matchOptions: LogDashboardMatchOptions = { log_lines: lines };
      if (kind === "K8S_LOGS_POD_PROBLEM") matchOptions.k8s_problems = s.problems;
      if (kind.endsWith("_ERROR_LINES")) matchOptions.log_categories = s.anyError ? [] : s.categories;
      if (kind === "DOCKER_LOGS_CONTAINER_EXITED") matchOptions.only_unexpected_exits = s.onlyUnexpected;
      payloads.push({
        kind,
        condition: kind === "DOCKER_LOGS_CONTAINER_EXITED" ? ("==" as const) : (">=" as const),
        threshold: kind.endsWith("_ERROR_LINES") ? threshold : 1,
        duration_seconds: kind === "DOCKER_LOGS_CONTAINER_EXITED" ? 0 : Math.round(windowMinutes * 60),
        severity: s.severity,
        match_options: matchOptions,
      });
    }
    setSubmitting(true);
    try {
      for (const p of payloads) {
        if (existing) {
          await updateAlertRule(existing.rule.id, {
            condition: p.condition,
            threshold: p.threshold,
            duration_seconds: p.duration_seconds,
            severity: p.severity,
            notification_policy_id: policyId || undefined,
            enabled,
            match_options: p.match_options,
          });
        } else {
          // One rule per dashboard and alert kind.
          for (const dashboardId of selectedDashboards) {
            await createAlertRule({
              monitoring_dashboard_id: dashboardId,
              alert_type: p.kind,
              condition: p.condition,
              threshold: p.threshold,
              duration_seconds: p.duration_seconds,
              severity: p.severity,
              notification_policy_id: policyId || undefined,
              enabled,
              match_options: p.match_options,
            });
          }
        }
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save the alert rule.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={embedded ? "flex flex-col gap-5" : "flex flex-col gap-5 rounded-lg border border-slate-200 bg-white p-4"}>
      {!embedded && (
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Bell className="h-4 w-4" /> {editing ? "Edit log alert" : "New log alert"}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Watches every app or container in a {logKind === "K8S" ? "Kubernetes" : "Docker"} Log Explorer dashboard and raises one
            alert per app or container that matches, with the relevant log lines attached to the alert and its notifications.
          </p>
        </div>
      )}

      {dashboardName ? (
        <p className="text-sm text-slate-700">
          Dashboard: <span className="font-medium text-slate-900">{dashboardName}</span>
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <Label>Folders and dashboards</Label>
            {selectedDashboards.length > 0 && (
              <span className="text-xs text-slate-500">
                {selectedDashboards.length} dashboard{selectedDashboards.length === 1 ? "" : "s"} selected -- one rule per dashboard
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Tick a folder to take all its dashboards, or pick dashboards one by one. Each alert covers exactly the namespaces, apps or
            containers its dashboard shows.
          </p>
          {dashboards === null ? (
            <p className="text-sm text-slate-500">Loading&hellip;</p>
          ) : folders.length === 0 ? (
            <p className="rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500">
              No {logKind === "K8S" ? "Kubernetes" : "Docker"} log dashboards yet -- create one under Log Management &rsaquo;{" "}
              {logKind === "K8S" ? "Kubernetes" : "Docker"} Log Explorer first.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {folders.map((g) => {
                const picked = g.dashboards.filter((d) => selectedDashboards.includes(d.id)).length;
                return (
                  <div key={g.key} className={`rounded-md border p-2.5 ${picked > 0 ? "border-sky-200 bg-sky-50/40" : "border-slate-200"}`}>
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-900">
                      <Checkbox
                        checked={picked === g.dashboards.length}
                        onCheckedChange={(v) => toggleFolder(g, v === true)}
                        disabled={submitting}
                      />
                      {g.name}
                      <span className="text-xs font-normal text-slate-400">
                        {g.workspace} · {picked > 0 ? `${picked}/${g.dashboards.length} selected` : `${g.dashboards.length} dashboard${g.dashboards.length === 1 ? "" : "s"}`}
                      </span>
                    </label>
                    <div className="mt-1.5 ml-6 flex flex-col gap-1">
                      {g.dashboards.map((d) => (
                        <label key={d.id} className="flex items-center gap-2 text-xs text-slate-600">
                          <Checkbox
                            checked={selectedDashboards.includes(d.id)}
                            onCheckedChange={(v) => setSelectedDashboards((cur) => toggle(cur, d.id, v === true))}
                            disabled={submitting}
                          />
                          <span className="text-slate-800">{d.name}</span>
                          <span className="text-slate-400">on {d.bound_resource_name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {!editing && <Label>Alert on</Label>}
        {kinds.map((kind) => {
          const s = settings[kind];
          const info = RULE_INFO[kind];
          return (
            <div key={kind} className={`rounded-lg border p-3 ${s.on ? "border-sky-200 bg-sky-50/40" : "border-slate-200"}`}>
              <label className="flex items-start gap-2">
                {!editing && (
                  <Checkbox className="mt-0.5" checked={s.on} onCheckedChange={(v) => update(kind, { on: v === true })} disabled={submitting} />
                )}
                <span>
                  <span className="block text-sm font-medium text-slate-900">{info.title}</span>
                  <span className="block text-xs text-slate-500">{info.hint}</span>
                </span>
              </label>

              {s.on && (
                <div className={`mt-3 flex flex-col gap-3 ${editing ? "" : "pl-6"}`}>
                  {kind === "K8S_LOGS_POD_PROBLEM" && (
                    <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
                      {K8S_PROBLEM_CHOICES.map((c) => (
                        <label key={c.value} className="flex items-start gap-2 text-xs text-slate-700">
                          <Checkbox
                            className="mt-px"
                            checked={s.problems.includes(c.value)}
                            onCheckedChange={(v) => update(kind, { problems: toggle(s.problems, c.value, v === true) })}
                            disabled={submitting}
                          />
                          {c.label}
                        </label>
                      ))}
                    </div>
                  )}

                  {kind.endsWith("_ERROR_LINES") && (
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap gap-4 text-sm text-slate-700">
                        <label className="flex items-center gap-2">
                          <input type="radio" checked={s.anyError} onChange={() => update(kind, { anyError: true })} disabled={submitting} />
                          Any error or critical line
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="radio" checked={!s.anyError} onChange={() => update(kind, { anyError: false })} disabled={submitting} />
                          Only these kinds of lines
                        </label>
                      </div>
                      {!s.anyError && (
                        <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
                          {LOG_CATEGORY_CHOICES.map((c) => (
                            <label key={c.value} className="flex items-start gap-2 text-xs text-slate-700">
                              <Checkbox
                                className="mt-px"
                                checked={s.categories.includes(c.value)}
                                onCheckedChange={(v) => update(kind, { categories: toggle(s.categories, c.value, v === true) })}
                                disabled={submitting}
                              />
                              {c.label}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {kind === "DOCKER_LOGS_CONTAINER_EXITED" && (
                    <label className="flex items-center gap-2 text-xs text-slate-700">
                      <Checkbox checked={s.onlyUnexpected} onCheckedChange={(v) => update(kind, { onlyUnexpected: v === true })} disabled={submitting} />
                      Only unexpected stops (ignore exit code 0 and a normal docker stop)
                    </label>
                  )}

                  <div className="flex flex-wrap items-end gap-3">
                    {kind.endsWith("_ERROR_LINES") && (
                      <div className="flex flex-col gap-1">
                        <Label className="text-xs">At least this many lines</Label>
                        <Input
                          type="number"
                          min={1}
                          className="h-8 w-28"
                          value={s.threshold}
                          onChange={(e) => update(kind, { threshold: e.target.value })}
                          disabled={submitting}
                        />
                      </div>
                    )}
                    {kind !== "DOCKER_LOGS_CONTAINER_EXITED" && (
                      <div className="flex flex-col gap-1">
                        <Label className="text-xs">{kind === "K8S_LOGS_POD_PROBLEM" ? "Count restarts and events from the last (minutes)" : "Within the last (minutes)"}</Label>
                        <Input
                          type="number"
                          min={1}
                          max={1440}
                          className="h-8 w-28"
                          value={s.windowMinutes}
                          onChange={(e) => update(kind, { windowMinutes: e.target.value })}
                          disabled={submitting}
                        />
                      </div>
                    )}
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">Severity</Label>
                      <Select value={s.severity} onValueChange={(v) => update(kind, { severity: (v as AlertSeverity) ?? info.severity })} disabled={submitting}>
                        <SelectTrigger size="sm" className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SEVERITIES.map((sv) => (
                            <SelectItem key={sv} value={sv}>
                              {sv}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label>Log lines to include in the alert</Label>
          <Input type="number" min={0} max={100} value={logLines} onChange={(e) => setLogLines(e.target.value)} disabled={submitting} />
          <p className="text-xs text-slate-500">Shown on the alert and sent with Email, Slack, Teams and webhook notifications. 0 = none.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Notification Policy</Label>
          <Select value={policyId || DEFAULT_POLICY} onValueChange={(v) => setPolicyId(v === DEFAULT_POLICY ? "" : (v ?? ""))} disabled={submitting}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={DEFAULT_POLICY}>Use the default policy</SelectItem>
              {policies.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                  {p.is_default ? " (default)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-slate-500">Which channels deliver it -- manage channels under Alerts &rsaquo; Notifications.</p>
        </div>
      </div>

      <label className="flex w-fit items-center gap-2 text-sm text-slate-700">
        <Checkbox checked={enabled} onCheckedChange={(v) => setEnabled(v === true)} disabled={submitting} />
        {editing ? "Enabled" : "Enabled immediately"}
      </label>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? "Saving…" : editing ? "Save Changes" : "Save"}
        </Button>
      </div>
    </form>
  );
}
