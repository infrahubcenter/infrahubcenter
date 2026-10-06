// Threshold helpers for the New Alert Rule form: which quick-pick values
// to offer for each alert type, its unit, and a one-line explanation.
// Derived from the backend's own template catalog (metric name, default
// condition and threshold), so no alert type is hardcoded here.

import type { AlertCondition, AlertTemplate } from "./api";

export type ThresholdKind = "percent" | "flag" | "number";

// "flag" metrics are yes/no events (unreachable, stopped, public bucket...)
// the backend models as == 1 -- there is no meaningful number to pick.
export function thresholdKind(t: AlertTemplate): ThresholdKind {
  if (t.default_condition === "==" && t.default_threshold === 1) return "flag";
  if (t.metric.toUpperCase().includes("PERCENT")) return "percent";
  return "number";
}

export function thresholdUnit(t: AlertTemplate): string {
  const m = t.metric.toUpperCase();
  if (m === "K8S_POD_MEMORY_BYTES") return "MB";
  if (m === "DB_STORAGE_BYTES") return "GB";
  if (m === "HOST_LOAD_PER_CORE") return "load per core";
  if (m === "K8S_NODES_NOT_READY") return "nodes";
  if (m === "K8S_PODS_NOT_RUNNING") return "pods";
  if (m.includes("RESTART_COUNT")) return "restarts";
  if (m.includes("LOG_ERROR_COUNT")) return "error lines";
  if (m.includes("PERCENT")) return "%";
  if (m.endsWith("_MS") || m.includes("_MS_") || m.includes("LATENCY")) return "ms";
  if (m.includes("SECS") || m.includes("SECONDS") || m.includes("LAG")) return "seconds";
  if (m.includes("MILLICORES")) return "millicores";
  if (m.includes("COUNT") || m.includes("LOCKS")) return "";
  return "";
}

// Quick-pick values: 50 / 70 / 90 for percentages; half, the default and
// double the default for other numbers; none for yes/no events.
export function thresholdPresets(t: AlertTemplate): number[] {
  const kind = thresholdKind(t);
  if (kind === "flag") return [];
  if (kind === "percent") return [50, 70, 90];
  const d = t.default_threshold;
  const round = (n: number) => (n >= 10 ? Math.round(n) : Math.round(n * 10) / 10);
  return Array.from(new Set([round(d / 2), round(d), round(d * 2)])).filter((n) => n > 0);
}

const CONDITION_WORDS: Record<AlertCondition, string> = {
  ">": "goes above",
  "<": "drops below",
  ">=": "reaches or goes above",
  "<=": "reaches or drops below",
  "==": "equals",
};

// What this rule will do with the threshold currently entered.
export function thresholdExplanation(t: AlertTemplate, condition: AlertCondition, threshold: string, durationSeconds: string): string {
  const kind = thresholdKind(t);
  const secs = Number(durationSeconds);
  const hold = Number.isFinite(secs) && secs > 0 ? ` and stays that way for ${formatDuration(secs)}` : "";
  if (kind === "flag") {
    return `Raises an alert when this happens${hold} -- no number needed.`;
  }
  const unit = thresholdUnit(t);
  const value = threshold.trim() === "" ? "the threshold" : `${threshold}${unit === "%" ? "%" : unit ? ` ${unit}` : ""}`;
  return `Raises an alert when the value ${CONDITION_WORDS[condition]} ${value}${hold}.`;
}

function formatDuration(secs: number): string {
  if (secs % 3600 === 0) return `${secs / 3600} hour${secs === 3600 ? "" : "s"}`;
  if (secs % 60 === 0) return `${secs / 60} minute${secs === 60 ? "" : "s"}`;
  return `${secs} seconds`;
}

// What each alert type watches, in one line -- shown under its checkbox.
export const ALERT_TYPE_HINTS: Record<string, string> = {
  VM_HIGH_CPU: "Average CPU across all cores.",
  VM_HIGH_MEMORY: "RAM in use, excluding caches the OS can free.",
  VM_HIGH_STORAGE: "Total disk space used across the VM.",
  VM_DISK_NEARLY_FULL: "The fullest single disk or mount point (e.g. /var or /data).",
  VM_UNAVAILABLE: "InfraHub can't reach the VM over SSH or its agent.",
  DOCKER_CONTAINER_STOPPED: "The container exited or died.",
  DOCKER_CONTAINER_RESTARTING: "Docker is restarting the container in a loop.",
  DOCKER_CONTAINER_UNHEALTHY: "The container's HEALTHCHECK reports unhealthy.",
  DOCKER_CONTAINER_HIGH_CPU: "The container's CPU share of the host.",
  DOCKER_CONTAINER_HIGH_MEMORY: "Memory used against the container's limit.",
  DOCKER_CONTAINER_RESTARTS: "Total restarts Docker has made for the container.",
  DOCKER_CONTAINER_HIGH_ERROR_LOGS: "Error and critical lines in the container's logs.",
  DATABASE_UNAVAILABLE: "Connections to the database fail.",
  DATABASE_HIGH_CONNECTIONS: "Open connections against max_connections.",
  DATABASE_HIGH_LATENCY: "95th-percentile query time.",
  DATABASE_LOCK_CONTENTION: "Queries waiting on locks.",
  DATABASE_REPLICATION_LAG: "How far a replica is behind the primary.",
  DATABASE_HIGH_STORAGE: "Size of the database on disk.",
  DATABASE_LOW_CACHE_HIT: "Share of reads served from memory.",
  OBJECT_STORAGE_UNAVAILABLE: "The bucket can't be reached.",
  OBJECT_STORAGE_HIGH_GROWTH: "How fast the bucket is growing.",
  OBJECT_STORAGE_PUBLIC_ACCESS: "The bucket became publicly readable.",
  OBJECT_STORAGE_ENCRYPTION_DISABLED: "Default encryption is turned off.",
  OBJECT_STORAGE_HIGH_ERROR_RATE: "Share of requests that fail.",
  DOCKER_HOST_UNAVAILABLE: "The Docker agent on the host disconnected.",
  DOCKER_HOST_HIGH_CPU: "The whole host's CPU, read live from the agent.",
  DOCKER_HOST_HIGH_MEMORY: "The whole host's RAM in use.",
  DOCKER_HOST_HIGH_DISK: "The host's disk where Docker keeps its data.",
  DOCKER_HOST_HIGH_LOAD: "5-minute load average divided by CPU cores (above 1 = queueing).",
  DOCKER_HOST_CONTAINER_STOPPED: "This container exited, died or was removed.",
  DOCKER_HOST_CONTAINER_HIGH_CPU: "This container's CPU, read live from the agent.",
  DOCKER_HOST_CONTAINER_HIGH_MEMORY: "Memory used against this container's limit.",
  DOCKER_HOST_CONTAINER_HIGH_ERROR_LOGS: "Error and critical lines in this container's logs.",
  K8S_CLUSTER_UNAVAILABLE: "The cluster's agent disconnected.",
  K8S_CLUSTER_NODE_NOT_READY: "Nodes reporting NotReady.",
  K8S_CLUSTER_HIGH_NODE_CPU: "The busiest node's CPU against what it can allocate.",
  K8S_CLUSTER_HIGH_NODE_MEMORY: "The busiest node's memory against what it can allocate.",
  K8S_CLUSTER_PODS_NOT_RUNNING: "Pods stuck Pending, Failed or Unknown.",
  K8S_POD_NOT_RUNNING: "The pod isn't in the Running phase.",
  K8S_POD_CRASH_LOOPING: "Container restarts across the pod.",
  K8S_POD_HIGH_CPU: "CPU used by the pod, in millicores (1000 = one core).",
  K8S_POD_HIGH_MEMORY: "Memory used by the pod.",
  K8S_POD_HIGH_ERROR_LOGS: "Error and critical lines in the pod's logs.",
};

// Alert types worth turning on for almost any resource -- ticked by the
// form's "Tick recommended" button.
export const RECOMMENDED_ALERT_TYPES = new Set([
  "VM_HIGH_CPU", "VM_HIGH_MEMORY", "VM_DISK_NEARLY_FULL", "VM_UNAVAILABLE",
  "DOCKER_CONTAINER_STOPPED", "DOCKER_CONTAINER_UNHEALTHY", "DOCKER_CONTAINER_HIGH_MEMORY",
  "DATABASE_UNAVAILABLE", "DATABASE_HIGH_CONNECTIONS", "DATABASE_HIGH_LATENCY",
  "OBJECT_STORAGE_UNAVAILABLE", "OBJECT_STORAGE_PUBLIC_ACCESS",
  "DOCKER_HOST_UNAVAILABLE", "DOCKER_HOST_HIGH_DISK", "DOCKER_HOST_HIGH_MEMORY",
  "DOCKER_HOST_CONTAINER_STOPPED", "DOCKER_HOST_CONTAINER_HIGH_MEMORY",
  "K8S_CLUSTER_UNAVAILABLE", "K8S_CLUSTER_NODE_NOT_READY", "K8S_CLUSTER_PODS_NOT_RUNNING",
  "K8S_POD_NOT_RUNNING", "K8S_POD_CRASH_LOOPING",
]);

// "How long must it last" quick picks, in seconds.
export const DURATION_PRESETS: { seconds: number; label: string }[] = [
  { seconds: 0, label: "Immediately" },
  { seconds: 60, label: "1 min" },
  { seconds: 300, label: "5 min" },
  { seconds: 900, label: "15 min" },
  { seconds: 1800, label: "30 min" },
];

// Groups for the alert type list: yes/no events vs. measured values.
export function alertTypeGroup(t: AlertTemplate): "State" | "Usage & performance" {
  return thresholdKind(t) === "flag" ? "State" : "Usage & performance";
}
