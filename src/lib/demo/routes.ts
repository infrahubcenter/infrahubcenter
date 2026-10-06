// The demo's stand-in for the Infra Hub API: every read the console makes
// is answered here, in the browser, from the sample data in ./data. Nothing
// ever leaves the page except sign-in (see app/api/auth).

import type {
  AlertTemplate,
  DatabaseDetail,
  DatabaseMetricsCurrent,
  DatabasePerformance,
  DockerContainerMetric,
  DockerHostResources,
  DockerHostSystemMetrics,
  K8sClusterResourcesResult,
  LogSearchResult,
  LogSeverity,
  MeSettings,
  MonitoringCurrent,
  MonitoringOverview,
  MonitoringResource,
  ObjectStorageDetail,
  OperationLogLine,
  PlatformSettings,
  User,
  UserDetail,
  VMAgentMetrics,
} from "@/lib/api";
import {
  ALERT_RULES,
  DATABASES,
  DOCKER_HOSTS,
  GiB,
  K8S_CLUSTERS,
  MiB,
  NOTIFICATION_POLICIES,
  REBOOT_OPERATIONS,
  STORAGES,
  TEAM,
  UPDATE_OPERATIONS,
  UPDATE_PLANS,
  VMS,
  WORKSPACES,
  ago,
  alertRuleList,
  alerts,
  auditLogs,
  clusterIndex,
  containerSetFor,
  databaseIndex,
  databaseOperations,
  dockerAccessGrants,
  dockerHostIndex,
  hostContainers,
  k8sNodes,
  k8sPods,
  monitoringDashboards,
  monitoringFolders,
  notifications,
  recommendations,
  storageIndex,
  uid,
  unifiedOperations,
  vmContainerIndex,
  vmContainers,
  vmLoad,
  vmPackageUpdates,
  vmPackages,
  vmSeed,
  wave,
} from "./data";

export type DemoResponse = { status: number; body: unknown };

let currentUser: User = { id: uid("0b", 1), name: "Demo User", email: "demo@infrahub.example", role: "OWNER" };

export function setDemoUser(user: User) {
  currentUser = user;
}

const ok = (body: unknown): DemoResponse => ({ status: 200, body });
const notFound = (): DemoResponse => ({ status: 404, body: { error: "Not found in the demo" } });

// ------------------------------------------------------------ generators

export function vmAgentMetrics(vmId: string, t = Date.now()): VMAgentMetrics {
  const l = vmLoad(vmId);
  const vm = VMS.find((v) => v.id === vmId);
  return {
    captured_at: new Date(t).toISOString(),
    cpu_percent: wave(l.seed, l.cpu, 8, t),
    cpu_cores: l.cores,
    memory_used_bytes: Math.round((l.memTotal * wave(l.seed + 1, l.mem, 4, t)) / 100),
    memory_total_bytes: l.memTotal,
    swap_used_bytes: 128 * MiB,
    swap_total_bytes: 2 * GiB,
    load_1m: Math.round(wave(l.seed, (l.cpu / 100) * l.cores, 0.5, t) * 100) / 100,
    load_5m: Math.round(((l.cpu / 100) * l.cores) * 90) / 100,
    load_15m: Math.round(((l.cpu / 100) * l.cores) * 85) / 100,
    uptime_seconds: 86400 * (12 + l.seed) + 3600 * 5,
    storage_used_bytes: Math.round((l.diskTotal * l.disk) / 100),
    storage_total_bytes: l.diskTotal,
    network_rx_rate_bytes: wave(l.seed + 3, 420_000, 150_000, t),
    network_tx_rate_bytes: wave(l.seed + 4, 180_000, 60_000, t),
    process_count: 140 + l.seed * 7,
    agent_os: vm?.agent_os ?? "linux",
    agent_os_version: vm?.agent_os_version ?? `${vm?.os_name} ${vm?.os_version}`,
    agent_kernel_version: vm?.kernel_version,
    agent_hostname: vm?.name,
  };
}

function monitoringCurrent(vmId: string): MonitoringCurrent {
  const l = vmLoad(vmId);
  const cpu = wave(l.seed, l.cpu, 8);
  const mem = wave(l.seed + 1, l.mem, 4);
  if (l.offline) {
    return { status: "OFFLINE", captured_at: ago(60 * 5), stale_after_seconds: 180, monitoring_enabled: false, last_run_status: "FAILED", last_run_error: "dial tcp 10.30.1.21:22: i/o timeout" };
  }
  return {
    status: cpu > 85 ? "CRITICAL" : cpu > 70 ? "WARNING" : "HEALTHY",
    captured_at: ago(0.5),
    stale_after_seconds: 180,
    monitoring_enabled: true,
    cpu: { usage_percent: cpu, user_percent: cpu * 0.7, system_percent: cpu * 0.2, iowait_percent: cpu * 0.05, idle_percent: 100 - cpu, cores: l.cores },
    memory: { total_bytes: l.memTotal, used_bytes: (l.memTotal * mem) / 100, available_bytes: (l.memTotal * (100 - mem)) / 100, usage_percent: mem },
    swap: { configured: true, total_bytes: 2 * GiB, used_bytes: 128 * MiB, usage_percent: 6.3 },
    load: { one_minute: (cpu / 100) * l.cores, five_minutes: (l.cpu / 100) * l.cores, fifteen_minutes: (l.cpu / 100) * l.cores * 0.9, load_per_cpu: cpu / 100 },
    uptime_seconds: 86400 * (12 + l.seed),
    storage: { total_bytes: l.diskTotal, used_bytes: (l.diskTotal * l.disk) / 100, usage_percent: l.disk },
    network: { rx_bytes_per_sec: wave(l.seed + 3, 420_000, 150_000), tx_bytes_per_sec: wave(l.seed + 4, 180_000, 60_000) },
    filesystems: [
      { mount_point: "/", filesystem: "ext4", total_bytes: l.diskTotal * 0.8, used_bytes: (l.diskTotal * 0.8 * l.disk) / 100, available_bytes: (l.diskTotal * 0.8 * (100 - l.disk)) / 100, usage_percent: l.disk },
      { mount_point: "/boot", filesystem: "ext4", total_bytes: 1 * GiB, used_bytes: 0.3 * GiB, available_bytes: 0.7 * GiB, usage_percent: 30 },
    ],
    network_interfaces: [{ name: "eth0", rx_bytes_per_sec: wave(l.seed + 3, 420_000, 150_000), tx_bytes_per_sec: wave(l.seed + 4, 180_000, 60_000), rx_errors: 0, tx_errors: 0, rx_dropped: 2, tx_dropped: 0 }],
    process: { total: 140 + l.seed * 7, running: 3, sleeping: 137 + l.seed * 7, zombie: 0 },
    last_run_status: "SUCCESS",
  };
}

function series<T>(count: number, stepMinutes: number, make: (t: number, i: number) => T): T[] {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => make(now - (count - 1 - i) * stepMinutes * 60_000, i));
}

const LOG_TEMPLATES: [string, LogSeverity, string?, string?][] = [
  ['GET /api/products?page=2 200 18ms', "HEALTHY"],
  ['POST /api/cart/items 201 42ms', "HEALTHY"],
  ["cache hit ratio 0.97 over last 60s", "HEALTHY"],
  ['GET /api/checkout/session 200 65ms', "HEALTHY"],
  ["slow query detected: 1240ms SELECT * FROM order_items WHERE order_id = $1", "WARNING", "performance", "Add an index on order_items(order_id)."],
  ["retrying payment provider request (attempt 2/3)", "WARNING", "network"],
  ['POST /api/checkout/confirm 502 3012ms upstream timed out', "ERROR", "http_5xx", "Check the payments-gateway service health."],
  ["worker heartbeat ok, 12 jobs processed", "HEALTHY"],
  ["authentication failed for user 'reporting' from 198.51.100.24", "ERROR", "auth_failure", "Verify credentials or block the source address."],
  ["connection pool usage 78% (39/50)", "WARNING", "resource"],
  ["panic: runtime error: invalid memory address or nil pointer dereference", "CRITICAL", "crash", "Inspect the stack trace and recent deploys."],
  ['GET /healthz 200 1ms', "HEALTHY"],
];

export function sampleLogLine(i: number): { line: string; severity: LogSeverity; category?: string; suggestion?: string } {
  const [line, severity, category, suggestion] = LOG_TEMPLATES[i % LOG_TEMPLATES.length];
  return { line, severity, category, suggestion };
}

function logSearch(seed: number, q: URLSearchParams): LogSearchResult {
  let lines = series(120, 0.5, (t, i) => {
    const s = sampleLogLine(i * 7 + seed);
    return { id: String(i), logged_at: new Date(t).toISOString(), ...s, line: `${new Date(t).toISOString()} ${s.line}` };
  }).reverse();
  const counts = { healthy: 0, warning: 0, error: 0, critical: 0 };
  for (const l of lines) counts[l.severity.toLowerCase() as keyof typeof counts]++;
  const text = q.get("q")?.toLowerCase();
  if (text) lines = lines.filter((l) => l.line.toLowerCase().includes(text));
  const sev = q.get("severity");
  if (sev) lines = lines.filter((l) => l.severity === sev);
  const offset = Number(q.get("offset") ?? 0);
  const limit = Number(q.get("limit") ?? 100);
  return { lines: lines.slice(offset, offset + limit), total: lines.length, retention_cutoff: ago(60 * 24 * 3), counts };
}

export function dockerMetric(vmOrHostIndex: number, containerIdx: number, t = Date.now()): DockerContainerMetric {
  const c = containerSetFor(vmOrHostIndex)[containerIdx] ?? containerSetFor(vmOrHostIndex)[0];
  return {
    container_id: hostContainers(vmOrHostIndex)[containerIdx]?.container_id ?? "",
    container_name: c.name,
    captured_at: new Date(t).toISOString(),
    stale: false,
    cpu_percent: wave(vmOrHostIndex * 10 + containerIdx, c.cpu, Math.max(2, c.cpu * 0.3), t),
    memory_usage_bytes: c.memMiB * MiB,
    memory_limit_bytes: 2048 * MiB,
    memory_percent: Math.round((c.memMiB / 2048) * 1000) / 10,
    network_rx_bytes: (containerIdx + 1) * 734 * MiB,
    network_tx_bytes: (containerIdx + 1) * 312 * MiB,
    block_read_bytes: (containerIdx + 1) * 88 * MiB,
    block_write_bytes: (containerIdx + 1) * 41 * MiB,
    pids: 6 + containerIdx * 3,
  };
}

function containerIndexById(set: number, containerId: string): number {
  const byRow = vmContainersForIndex(set).findIndex((c) => c.id === containerId || c.container_id === containerId);
  return byRow < 0 ? 0 : byRow;
}

function vmContainersForIndex(index: number) {
  const vm = VMS[index] ?? VMS[0];
  return vmContainers(vm.id);
}

export function databaseMetricsFrame(dbId: string, t = Date.now()) {
  const i = databaseIndex(dbId);
  const db = DATABASES[i];
  const down = db.connection_status !== "CONNECTED";
  return {
    captured_at: new Date(t).toISOString(),
    health: db.health,
    metrics_status: down ? "FAILED" : "OK",
    common: down
      ? undefined
      : {
          connections: Math.round(wave(i, 40 + i * 12, 8, t)),
          active_connections: Math.round(wave(i + 1, 9 + i * 3, 4, t)),
          max_connections: db.type === "MYSQL" ? 150 : 200,
          memory_usage_bytes: (db.type === "REDIS" ? 1.4 : 3.2) * GiB,
          database_size_bytes: (18 + i * 21) * GiB,
          operations_per_second: db.type === "REDIS" || db.type === "MONGODB" ? wave(i, 2400, 600, t) : undefined,
          transactions_per_second: db.type === "POSTGRESQL" || db.type === "MYSQL" ? wave(i, 310, 90, t) : undefined,
          errors: i,
          uptime_seconds: 86400 * (30 + i * 4),
        },
  };
}

export function databasePerformance(dbId: string): DatabasePerformance {
  const i = databaseIndex(dbId);
  if (DATABASES[i].connection_status !== "CONNECTED") return { status: "NO_DATA" };
  return {
    captured_at: ago(0.5),
    metrics_status: "OK",
    cache_hit_ratio: 0.93 + (i % 3) * 0.02,
    locks: { waiting: i % 2, blocked: i === 2 ? 1 : 0 },
    replication: { status: "STREAMING", lag_seconds: 0.4 + i * 0.3, replica_count: 2 },
    latency_p50_ms: 3.1 + i,
    latency_p95_ms: 18 + i * 6,
    latency_p99_ms: 44 + i * 11,
    growth_bytes_per_day: (220 + i * 40) * MiB,
    sessions: [
      { pid: 48213, database: DATABASES[i].database_name, user: "app", duration_seconds: 2.4, state: "active", application_name: "checkout-api" },
      { pid: 48240, database: DATABASES[i].database_name, user: "reporting", duration_seconds: 186, state: "active", wait_event_type: "IO", wait_event: "DataFileRead", application_name: "metabase" },
      { pid: 48301, database: DATABASES[i].database_name, user: "app", duration_seconds: 0.2, state: "idle", application_name: "storefront-web" },
    ],
    top_queries: [
      { fingerprint: "q1a2b3", calls: 182_400, total_time_ms: 912_000, avg_time_ms: 5, rows: 182_400, database_name: DATABASES[i].database_name, database_user: "app", normalized_text: "SELECT * FROM products WHERE category_id = $1 ORDER BY popularity DESC LIMIT $2" },
      { fingerprint: "q4c5d6", calls: 20_120, total_time_ms: 1_450_000, avg_time_ms: 72, rows: 40_240, database_name: DATABASES[i].database_name, database_user: "app", normalized_text: "INSERT INTO order_events (order_id, type, payload) VALUES ($1, $2, $3)" },
      { fingerprint: "q7e8f9", calls: 310, total_time_ms: 384_000, avg_time_ms: 1240, rows: 9_300, database_name: DATABASES[i].database_name, database_user: "reporting", normalized_text: "SELECT o.*, i.* FROM orders o JOIN order_items i ON i.order_id = o.id WHERE o.created_at > $1" },
    ],
  };
}

function databaseDetail(dbId: string): DatabaseDetail {
  const d = DATABASES[databaseIndex(dbId)];
  return { ...d, region: "us-east-1", tls_enabled: true, tls_skip_verify: false, last_metrics_at: d.last_metric_at, credential_username: "infrahub_monitor", credential_configured: true };
}

function storageDetail(id: string): ObjectStorageDetail {
  const s = STORAGES[storageIndex(id)];
  return {
    ...s,
    base_path: "",
    tls_enabled: true,
    tls_skip_verify: false,
    access_key_id: "AKIADEMOEXAMPLE0001",
    credential_configured: true,
    capabilities: { metrics: true, browser: true, object_metadata: true, download: true, logs: false, versioning: true, encryption: true },
    security: { versioning: "ENABLED", encryption: "ENABLED", object_lock: s.provider === "MINIO" ? "ENABLED" : "DISABLED", public_access: "PRIVATE" },
    health_reasons: s.health_status === "WARNING" ? ["Bucket size grew 18% in the last 7 days"] : [],
    growth_projection: { current_bytes: s.total_size_bytes ?? 0, growth_bytes_per_day: 2.4 * GiB, estimated_30d_growth_bytes: 72 * GiB },
  };
}

const OBJECT_TREE: Record<string, { name: string; folder?: boolean; size?: number; type?: string }[]> = {
  "": [{ name: "images/", folder: true }, { name: "videos/", folder: true }, { name: "exports/", folder: true }, { name: "README.txt", size: 1_204, type: "text/plain" }, { name: "manifest.json", size: 8_812, type: "application/json" }],
  "images/": [{ name: "products/", folder: true }, { name: "banners/", folder: true }, { name: "logo.png", size: 48_220, type: "image/png" }],
  "images/products/": Array.from({ length: 12 }, (_, i) => ({ name: `sku-${1000 + i}.jpg`, size: 180_000 + i * 9_000, type: "image/jpeg" })),
  "images/banners/": [{ name: "summer-sale.webp", size: 320_000, type: "image/webp" }, { name: "new-arrivals.webp", size: 290_000, type: "image/webp" }],
  "videos/": [{ name: "product-tour.mp4", size: 84 * MiB, type: "video/mp4" }],
  "exports/": [{ name: "orders-2026-09.csv", size: 12 * MiB, type: "text/csv" }, { name: "customers-2026-09.csv", size: 4 * MiB, type: "text/csv" }],
};

function listObjects(bucket: string, prefix: string) {
  const entries = (OBJECT_TREE[prefix] ?? []).map((e) => ({
    type: e.folder ? ("FOLDER" as const) : ("OBJECT" as const),
    name: e.name.replace(/\/$/, ""),
    key: prefix + e.name,
    size_bytes: e.folder ? undefined : e.size,
    last_modified: e.folder ? undefined : ago(60 * 24 * 3),
    storage_class: e.folder ? undefined : "STANDARD",
  }));
  return { bucket, prefix, entries };
}

function findObject(key: string) {
  const slash = key.lastIndexOf("/");
  const prefix = slash >= 0 ? key.slice(0, slash + 1) : "";
  return (OBJECT_TREE[prefix] ?? []).find((e) => prefix + e.name === key);
}

function k8sResources(index: number): K8sClusterResourcesResult {
  const pods = k8sPods(index);
  const nsNames = Array.from(new Set(pods.map((p) => p.namespace ?? "default")));
  const seen = ago(1);
  return {
    status: "ok",
    nodes: k8sNodes(index),
    namespaces: nsNames.length + 3,
    node_count: k8sNodes(index).length,
    pods: pods.length,
    deployments: 6,
    stateful_sets: 1,
    daemon_sets: 2,
    services: 9,
    persistent_volume_claims: 3,
    replica_sets: 8,
    jobs: 2,
    cron_jobs: 1,
    persistent_volumes: 3,
    storage_classes: 2,
    ingresses: 2,
    network_policies: 3,
    endpoint_slices: 9,
    resource_quotas: 1,
    limit_ranges: 1,
    pod_disruption_budgets: 2,
    horizontal_pod_autoscalers: 2,
    namespace_items: [...nsNames, "default", "kube-system", "kube-public"].map((name) => ({ name, status: "Active" })),
    deployment_items: [
      { name: "storefront-web", namespace: nsNames[0], desired_replicas: 3, ready_replicas: 3 },
      { name: "checkout-api", namespace: nsNames[0], desired_replicas: 2, ready_replicas: 2 },
      { name: "payments-gateway", namespace: nsNames[1], desired_replicas: 2, ready_replicas: 2 },
      { name: "search-indexer", namespace: nsNames[2], desired_replicas: 1, ready_replicas: 0 },
      { name: "ingress-nginx-controller", namespace: "ingress-nginx", desired_replicas: 1, ready_replicas: 1 },
      { name: "coredns", namespace: "kube-system", desired_replicas: 2, ready_replicas: 2 },
    ],
    stateful_set_items: [{ name: "redis", namespace: nsNames[0], desired_replicas: 1, ready_replicas: 1 }],
    daemon_set_items: [{ name: "node-exporter", namespace: "monitoring", desired_replicas: 3, ready_replicas: 3 }, { name: "aws-node", namespace: "kube-system", desired_replicas: 3, ready_replicas: 3 }],
    service_items: [
      { name: "storefront-web", namespace: nsNames[0], type: "ClusterIP", cluster_ip: "172.20.14.10", ports: ["80/TCP"] },
      { name: "checkout-api", namespace: nsNames[0], type: "ClusterIP", cluster_ip: "172.20.14.22", ports: ["8080/TCP"] },
      { name: "ingress-nginx", namespace: "ingress-nginx", type: "LoadBalancer", cluster_ip: "172.20.1.5", ports: ["80/TCP", "443/TCP"] },
    ],
    pvc_items: [{ name: "redis-data", namespace: nsNames[0], status: "Bound", capacity_bytes: 10 * GiB, storage_class: "gp3" }],
    replica_set_items: [{ name: "storefront-web-7d9f8c6b5", namespace: nsNames[0], desired_replicas: 3, ready_replicas: 3, last_discovered_at: seen }],
    job_items: [{ name: "nightly-export-28790400", namespace: "batch", completions: 1, succeeded: 0, failed: 3, active: 0, last_discovered_at: seen }],
    cron_job_items: [{ name: "nightly-export", namespace: "batch", schedule: "0 2 * * *", suspended: false, active_jobs: 0, last_schedule_time: ago(60 * 8), last_discovered_at: seen }],
    pv_items: [{ name: "pvc-3f1c2a", status: "Bound", capacity_bytes: 10 * GiB, storage_class: "gp3", reclaim_policy: "Delete", last_discovered_at: seen }],
    storage_class_items: [{ name: "gp3", provisioner: "ebs.csi.aws.com", reclaim_policy: "Delete", is_default: true, last_discovered_at: seen }, { name: "efs", provisioner: "efs.csi.aws.com", reclaim_policy: "Retain", is_default: false, last_discovered_at: seen }],
    ingress_items: [{ name: "storefront", namespace: nsNames[0], class_name: "nginx", hosts: ["shop.northwind.example"], last_discovered_at: seen }],
    network_policy_items: [{ name: "default-deny", namespace: nsNames[1], policy_types: ["Ingress"], last_discovered_at: seen }],
    endpoint_slice_items: [{ name: "storefront-web-abcde", namespace: nsNames[0], address_type: "IPv4", endpoint_count: 3, last_discovered_at: seen }],
    resource_quota_items: [{ name: "team-quota", namespace: nsNames[0], hard: { "requests.cpu": "8", "requests.memory": "16Gi" }, last_discovered_at: seen }],
    limit_range_items: [{ name: "defaults", namespace: nsNames[0], types: ["Container"], last_discovered_at: seen }],
    pdb_items: [{ name: "storefront-web", namespace: nsNames[0], min_available: "2", current_healthy: 3, desired_healthy: 2, expected_pods: 3, last_discovered_at: seen }],
    hpa_items: [{ name: "checkout-api", namespace: nsNames[0], min_replicas: 2, max_replicas: 6, current_replicas: 2, target_cpu_percent: 70, last_discovered_at: seen }],
  };
}

const ALERT_TEMPLATES: AlertTemplate[] = [
  ["VM_HIGH_CPU", "cpu_usage_percent", "High CPU usage", 85, "CRITICAL", "VM"],
  ["VM_HIGH_MEMORY", "memory_usage_percent", "High memory usage", 90, "WARNING", "VM"],
  ["VM_HIGH_DISK", "storage_usage_percent", "High disk usage", 80, "WARNING", "VM"],
  ["VM_OFFLINE", "availability", "VM offline", 0, "CRITICAL", "VM"],
  ["VM_HIGH_ERROR_LOGS", "error_log_count", "Many error logs", 50, "WARNING", "VM"],
  ["DATABASE_HIGH_CONNECTIONS", "connections_percent", "High connection usage", 70, "WARNING", "DATABASE"],
  ["DATABASE_UNAVAILABLE", "availability", "Database unavailable", 0, "CRITICAL", "DATABASE"],
  ["OBJECT_STORAGE_UNAVAILABLE", "availability", "Bucket unreachable", 0, "CRITICAL", "OBJECT_STORAGE"],
  ["DOCKER_CONTAINER_HIGH_CPU", "cpu_percent", "Container high CPU", 70, "WARNING", "DOCKER_CONTAINER"],
  ["DOCKER_HOST_CONTAINER_HIGH_CPU", "cpu_percent", "Container high CPU", 70, "WARNING", "DOCKER_HOST_CONTAINER"],
  ["DOCKER_HOST_CONTAINER_HIGH_MEMORY", "memory_percent", "Container high memory", 90, "WARNING", "DOCKER_HOST_CONTAINER"],
  ["DOCKER_HOST_HIGH_ERROR_LOGS", "error_log_count", "Many container error logs", 50, "WARNING", "DOCKER_HOST"],
  ["K8S_POD_RESTARTS", "restart_count", "Pod restarting", 3, "WARNING", "K8S_POD"],
  ["K8S_CLUSTER_NODE_NOT_READY", "nodes_not_ready", "Node not ready", 0, "CRITICAL", "K8S_CLUSTER"],
  ["K8S_HIGH_ERROR_LOGS", "error_log_count", "Many pod error logs", 50, "WARNING", "K8S_POD"],
].map(([type, metric, label, threshold, severity, applies]) => ({
  type: type as string,
  metric: metric as string,
  label: label as string,
  default_condition: (threshold === 0 ? "==" : ">") as AlertTemplate["default_condition"],
  default_threshold: threshold as number,
  default_duration_seconds: 300,
  default_severity: severity as AlertTemplate["default_severity"],
  applies_to_resource: applies as string,
})).concat([
  { type: "K8S_LOGS_POD_PROBLEM", metric: "K8S_POD_PROBLEM_COUNT", label: "Kubernetes pod problem", default_condition: ">=", default_threshold: 1, default_duration_seconds: 600, default_severity: "CRITICAL", applies_to_resource: "K8S_LOG_DASHBOARD" },
  { type: "K8S_LOGS_ERROR_LINES", metric: "LOG_MATCH_COUNT", label: "Errors or suspicious activity in pod logs", default_condition: ">=", default_threshold: 1, default_duration_seconds: 300, default_severity: "WARNING", applies_to_resource: "K8S_LOG_DASHBOARD" },
  { type: "DOCKER_LOGS_CONTAINER_EXITED", metric: "CONTAINER_EXITED", label: "Container stopped", default_condition: "==", default_threshold: 1, default_duration_seconds: 0, default_severity: "CRITICAL", applies_to_resource: "DOCKER_LOG_DASHBOARD" },
  { type: "DOCKER_LOGS_ERROR_LINES", metric: "LOG_MATCH_COUNT", label: "Errors or suspicious activity in container logs", default_condition: ">=", default_threshold: 1, default_duration_seconds: 300, default_severity: "WARNING", applies_to_resource: "DOCKER_LOG_DASHBOARD" },
]);

function monitoringResources(): MonitoringResource[] {
  const active = alerts().filter((a) => a.status === "ACTIVE");
  const sev = (id: string) => active.find((a) => a.resource_id === id)?.severity;
  const wsName = (id?: string) => WORKSPACES.find((w) => w.id === id)?.name ?? "";
  return [
    ...VMS.filter((v) => v.address).map((v): MonitoringResource => ({ id: v.id, resource_type: "VM", name: v.name, workspace_id: v.workspace_id, workspace_name: v.workspace, health: v.status === "OFFLINE" ? "OFFLINE" : v.status === "WARNING" ? "CRITICAL" : "HEALTHY", availability: v.status === "OFFLINE" ? "UNAVAILABLE" : "AVAILABLE", connection_status: v.status === "OFFLINE" ? "FAILED" : "CONNECTED", monitoring_enabled: v.monitoring_enabled, active_alert_severity: sev(v.id), permissions: v.permissions, access_source: "ADMIN", last_seen_at: v.last_seen_at })),
    ...DATABASES.map((d): MonitoringResource => ({ id: d.id, resource_type: "DATABASE", name: d.name ?? "", workspace_id: d.workspace_id ?? "", workspace_name: wsName(d.workspace_id), health: d.health ?? "UNKNOWN", availability: d.connection_status === "CONNECTED" ? "AVAILABLE" : "UNAVAILABLE", connection_status: d.connection_status, monitoring_enabled: true, active_alert_severity: sev(d.resource_id), permissions: ["database.view"], access_source: "ADMIN", last_seen_at: d.last_metric_at })),
    ...STORAGES.map((s): MonitoringResource => ({ id: s.id, resource_type: "OBJECT_STORAGE", name: s.name, workspace_id: s.workspace_id ?? "", workspace_name: wsName(s.workspace_id), health: s.health_status ?? "UNKNOWN", availability: "AVAILABLE", connection_status: s.connection_status, monitoring_enabled: true, permissions: s.permissions, access_source: "ADMIN", last_seen_at: s.last_checked_at })),
  ];
}

function monitoringOverview(): MonitoringOverview {
  const a = alerts();
  const recs = recommendations();
  const allContainers = DOCKER_HOSTS.flatMap((_, i) => hostContainers(i));
  return {
    vms: { total: 8, healthy: 6, warning: 0, critical: 1, unknown: 0, offline: 1 },
    databases: { total: 5, healthy: 3, warning: 1, critical: 1, unknown: 0 },
    object_storage: { total: 3, healthy: 2, warning: 1, critical: 0, unavailable: 0 },
    docker: {
      hosts: DOCKER_HOSTS.length,
      containers_total: allContainers.length,
      containers_running: allContainers.filter((c) => c.status === "RUNNING").length,
      containers_stopped: allContainers.filter((c) => c.status === "EXITED").length,
      containers_unhealthy: allContainers.filter((c) => c.health === "UNHEALTHY").length,
      images_total: 17,
    },
    alerts: { critical: a.filter((x) => x.severity === "CRITICAL" && x.status === "ACTIVE").length, warning: a.filter((x) => x.severity === "WARNING" && x.status !== "RESOLVED").length, info: 1, active: a.filter((x) => x.status === "ACTIVE").length, acknowledged: 1, resolved_today: 1 },
    recommendations: { total: recs.length, new: 4, acknowledged: 1, dismissed: 0, resolved: 0, open_critical: 1, open_high: 1, open_medium: 2, open_low: 1 },
  };
}

function opLogs(kind: "update" | "reboot" | "database"): OperationLogLine[] {
  const lines: Record<string, string[]> = {
    update: ["Connecting to prod-web-02 over SSH", "Running prechecks: disk space OK, apt lock free", "Reading package lists...", "The following packages will be upgraded: openssl openssh-server curl libc6 python3.10 linux-image-generic", "Setting up openssl (3.0.2-0ubuntu1.18) ...", "Setting up openssh-server (1:8.9p1-3ubuntu0.10) ...", "Verifying installed versions", "6 of 6 packages verified"],
    reboot: ["Prechecks passed", "Sending: sudo systemctl reboot", "VM disconnected", "Waiting for SSH to come back", "Reconnected after 94s", "Boot ID changed, uptime 41s", "Kernel 5.15.0-119-generic is running", "All containers running again"],
    database: ["Connecting with the monitoring credential", "Executing: ANALYZE VERBOSE public.orders;", "INFO: analyzing \"public.orders\"", "INFO: \"orders\": scanned 30000 of 184220 pages", "Operation completed successfully"],
  };
  return lines[kind].map((message, i) => ({ sequence: i + 1, stream: i === 0 ? "SYSTEM" : "STDOUT", message, created_at: ago(140 - i * 0.5) }));
}

// ------------------------------------------------------------ router

type Handler = (m: RegExpMatchArray, q: URLSearchParams) => unknown;
const routes: [RegExp, Handler][] = [];
const get = (pattern: string, handler: Handler) => {
  routes.push([new RegExp(`^${pattern.replace(/:\w+/g, "([^/]+)")}$`), handler]);
};

const vmById = (id: string) => VMS.find((v) => v.id === id);

// auth & me
get("/api/me/settings", (): MeSettings => ({ name: currentUser.name, email: currentUser.email, theme: "SYSTEM", timezone: "Asia/Kolkata", date_format: "YYYY-MM-DD", muted_notification_categories: [] }));
get("/api/settings/platform", (): PlatformSettings => ({ platform_name: "Infra Hub Center (Demo)", vm_monitor_interval: "30s", vm_monitor_retention_days: 3, docker_metrics_interval: "15s", database_metrics_interval: "30s", database_metrics_retention_days: 3, object_storage_metrics_interval: "5m", alert_eval_interval: "30s", access_token_ttl_minutes: 15, refresh_token_ttl_days: 7, cookie_secure: true, login_rate_limit_attempts: 5, login_rate_limit_window: "15m", max_request_body_bytes: 10 * MiB, github_oauth_configured: false, google_oauth_configured: false, smtp_configured: true, is_owner: true }));
get("/api/settings/signin-methods", () => ({ github_client_id: "", github_secret_set: false, google_client_id: "", google_secret_set: false, smtp_host: "smtp.northwind.example", smtp_port: 587, smtp_username: "alerts@northwind.example", smtp_password_set: true, smtp_from_email: "alerts@northwind.example", smtp_use_tls: true }));

// plan: the sample company runs Business
get("/api/license", () => ({
  license: { plan: { id: "business", name: "Business", limits: { vms: 100, databases: 50, object_storage: 25, docker_hosts: 50, k8s_clusters: 15, users: -1 }, metrics_retention_days: 90, log_retention_days: 30 }, licensee: "Northwind Cloud (demo)", expires_at: new Date(Date.now() + 200 * 86_400_000).toISOString(), status: "active" },
  usage: { vms: VMS.length, databases: DATABASES.length, object_storage: STORAGES.length, docker_hosts: DOCKER_HOSTS.length, k8s_clusters: K8S_CLUSTERS.length, users: TEAM.filter((u) => u.is_active).length + 1 },
}));

// workspaces, users, permissions
get("/api/workspaces", () => ({ workspaces: WORKSPACES }));
get("/api/workspaces/:id", (m) => WORKSPACES.find((w) => w.id === m[1]) ?? WORKSPACES[0]);
get("/api/workspaces/:id/members", () => ({ members: TEAM.slice(0, 3).map((u) => ({ id: u.id, name: u.name, email: u.email, is_active: u.is_active, access_source: "WORKSPACE" })) }));
get("/api/resources", (_m, q) => {
  const all = [...DATABASES.map((d) => ({ id: d.resource_id, workspace_id: d.workspace_id ?? "", name: d.name ?? "", resource_type: "DATABASE", status: "ONLINE" })), ...STORAGES.map((s) => ({ id: s.resource_id, workspace_id: s.workspace_id ?? "", name: s.name, resource_type: "OBJECT_STORAGE", status: "ONLINE" }))];
  const type = q.get("resource_type");
  const ws = q.get("workspace_id");
  return { resources: all.filter((r) => (!type || r.resource_type === type) && (!ws || r.workspace_id === ws)) };
});
const allUsers = () => [{ ...currentUser, is_active: true, status: "ACTIVE" as const, last_login_at: ago(0), created_at: ago(60 * 24 * 365) }, ...TEAM];
get("/api/users", () => ({ users: allUsers(), total: allUsers().length, active_admin_count: 2 }));
get("/api/users/:id", (m): UserDetail => {
  const u = allUsers().find((x) => x.id === m[1]) ?? allUsers()[0];
  return { ...u, vm_access: VMS.slice(0, 3), database_access: DATABASES.slice(0, 2).map((d) => ({ ...d, permissions: ["database.view", "database.performance"], access_source: "DIRECT" as const })), object_storage_access: STORAGES.slice(0, 1).map((s) => ({ ...s, access_source: "WORKSPACE" as const })), workspaces: WORKSPACES.slice(0, 2).map((w) => ({ workspace_id: w.id, workspace_name: w.name })), active_admin_count: 2 };
});
get("/api/permissions", () => ({
  grants: [
    { resource: VMS[0], perm: "vm.view", user: TEAM[1] },
    { resource: VMS[0], perm: "vm.connect", user: TEAM[1] },
    { resource: VMS[2], perm: "vm.metrics", user: TEAM[2] },
    { resource: VMS[5], perm: "vm.updates", user: TEAM[2] },
  ].map((g) => ({ resource_id: g.resource.id, resource_type: "VM", resource_name: g.resource.name, workspace_id: g.resource.workspace_id, workspace_name: g.resource.workspace, user_id: g.user.id, user_name: g.user.name, user_email: g.user.email, user_role: g.user.role, permission: g.perm, description: { "vm.view": "View the VM and its inventory", "vm.connect": "Open the browser console", "vm.metrics": "View host metrics", "vm.updates": "View and plan patches" }[g.perm] ?? g.perm, granted_at: ago(60 * 24 * 10) })),
}));

// VMs
get("/api/vms", () => ({ vms: VMS }));
get("/api/vms/:id", (m) => vmById(m[1]));
get("/api/vms/:id/access", () => ({ members: TEAM.slice(0, 3).map((u, i) => ({ id: u.id, name: u.name, email: u.email, view: true, console: i < 2, access_source: i === 2 ? "WORKSPACE" : "DIRECT" })) }));
get("/api/ssh-key-credentials", () => ({ credentials: [{ id: uid("0d", 1), workspace_id: WORKSPACES[0].id, name: "prod-deploy-key", fingerprint: "SHA256:q2Xk7m1YdQ0mX9a1d5sDemoFingerprint0001", created_by: "Priya Sharma", created_at: ago(60 * 24 * 100), updated_at: ago(60 * 24 * 100), in_use_count: 5 }, { id: uid("0d", 2), workspace_id: WORKSPACES[1].id, name: "staging-key", fingerprint: "SHA256:Zt4Lr8pW3vDemoFingerprint0002", created_by: "Priya Sharma", created_at: ago(60 * 24 * 80), updated_at: ago(60 * 24 * 80), in_use_count: 2 }] }));
get("/api/ssh-key-credentials/:id", (m) => ({ id: m[1], workspace_id: WORKSPACES[0].id, name: "prod-deploy-key", fingerprint: "SHA256:q2Xk7m1YdQ0mX9a1d5sDemoFingerprint0001", created_at: ago(60 * 24 * 100), updated_at: ago(60 * 24 * 100), in_use_count: 5 }));
get("/api/vms/:id/connection-status", (m) => {
  const off = vmById(m[1])?.status === "OFFLINE";
  return { connection_status: off ? "FAILED" : "CONNECTED", credential_configured: true, last_connection_at: off ? ago(300) : ago(1), last_connection_error: off ? "dial tcp: i/o timeout" : undefined };
});
get("/api/vms/:id/discovery", () => ({ runs: [0, 1, 2].map((i) => ({ id: uid("23", i + 1), status: "SUCCESS", started_at: ago(45 + i * 60 * 24), completed_at: ago(44.8 + i * 60 * 24) })) }));
get("/api/vms/:id/vm-agent/status", (m) => {
  const vm = vmById(m[1]);
  const on = Boolean(vm?.agent_os);
  return { installed: on, connected: on && vm?.status !== "OFFLINE", version: on ? "1.0.0" : undefined, last_heartbeat_at: on ? ago(0.2) : undefined, token_configured: on, agent_os: vm?.agent_os };
});
get("/api/vms/:id/vm-agent/metrics/current", (m) => vmAgentMetrics(m[1]));
get("/api/vms/:id/vm-agent/metrics/history", (m, q) => ({ metrics: series(Math.min(Number(q.get("minutes") ?? 60), 360), 1, (t) => vmAgentMetrics(m[1], t)) }));
get("/api/vms/:id/vm-agent/logs/recent", (m) => {
  const r = logSearch(vmSeed(m[1])?.n ?? 1, new URLSearchParams());
  return { lines: r.lines.map((l) => ({ logged_at: l.logged_at, line: l.line, severity: l.severity, category: l.category, suggestion: l.suggestion })), total: r.total, since: ago(60), agent_connected: true, counts: r.counts };
});
get("/api/vms/:id/docker-agent/status", (m) => {
  const d = vmById(m[1])?.docker_installed;
  return { installed: Boolean(d), connected: Boolean(d), version: d ? "1.0.0" : undefined, last_heartbeat_at: d ? ago(0.3) : undefined, token_configured: Boolean(d) };
});
get("/api/vms/:id/monitoring/current", (m) => monitoringCurrent(m[1]));
get("/api/vms/:id/monitoring/history", (m) => {
  const l = vmLoad(m[1]);
  return { from: ago(60 * 24), to: ago(0), points: series(96, 15, (t) => ({ captured_at: new Date(t).toISOString(), status: "HEALTHY", cpu_usage_percent: wave(l.seed, l.cpu, 10, t), memory_usage_percent: wave(l.seed + 1, l.mem, 5, t), storage_usage_percent: l.disk, network_rx_rate_bytes: wave(l.seed + 3, 420_000, 150_000, t), network_tx_rate_bytes: wave(l.seed + 4, 180_000, 60_000, t) })) };
});

// packages & updates
get("/api/vms/:id/packages", (m, q) => {
  let p = vmPackages(m[1]);
  const s = q.get("search")?.toLowerCase();
  if (s) p = p.filter((x) => x.name.includes(s));
  const status = q.get("status");
  if (status) p = p.filter((x) => x.status === status);
  if (q.get("security")) p = p.filter((x) => x.is_security_update);
  return { packages: p, page: 1, page_size: 50, total: p.length };
});
get("/api/vms/:id/packages/summary", (m) => {
  const p = vmPackages(m[1]);
  return { total: 1_284, up_to_date: 1_284 - p.filter((x) => x.available_version).length, updates_available: p.filter((x) => x.available_version).length, security_updates: p.filter((x) => x.is_security_update).length, last_scan: ago(50), package_baseline_at: ago(60 * 24 * 60) };
});
get("/api/vms/:id/packages/updates", (m, q) => {
  let u = vmPackageUpdates(m[1]);
  if (q.get("security")) u = u.filter((x) => x.is_security_update);
  return { updates: u, page: 1, page_size: 50, total: u.length };
});
get("/api/vms/:id/packages/discovery-status", (m) => ({ runs: [{ id: uid("24", 1), package_manager: vmById(m[1])?.package_manager, status: "SUCCESS", package_count: 1_284, started_at: ago(51), completed_at: ago(50) }] }));
get("/api/vms/:id/packages/:pkg", (m) => vmPackages(m[1]).find((p) => p.id === m[2]) ?? vmPackages(m[1])[0]);
get("/api/vms/:id/external-packages", () => ({ packages: [["requests", "2.32.3", "PIP"], ["boto3", "1.34.144", "PIP"], ["pm2", "5.4.2", "NPM"], ["typescript", "5.5.4", "NPM"], ["bundler", "2.5.16", "GEM"], ["lxd", "5.21.2", "SNAP"]].map(([name, v, pm], i) => ({ id: uid("25", i + 1), name, installed_version: v, package_manager: pm, last_discovered_at: ago(50) })) }));
get("/api/recommendations", () => {
  const r = recommendations();
  return { recommendations: r, page: 1, page_size: 50, total: r.length };
});
const vmUpdates = (id: string) => {
  const u = vmPackageUpdates(id);
  const vm = vmById(id);
  const reboot = id === VMS[7].id;
  return {
    os: { current: `${vm?.os_name} ${vm?.os_version}`, available: vm?.os_name === "Ubuntu" && vm.os_version?.startsWith("22") ? "Ubuntu 24.04.1 LTS" : undefined, status: vm?.os_name === "Ubuntu" && vm.os_version?.startsWith("22") ? ("UPDATE_AVAILABLE" as const) : ("UP_TO_DATE" as const), update_type: "RELEASE" as const, release_channel: "lts", detected_at: ago(50) },
    kernel: { running: vm?.kernel_version, available: "5.15.0-119-generic", reboot_required: reboot, reboot_status: reboot ? ("REQUIRED" as const) : ("NOT_REQUIRED" as const), reboot_reason: reboot ? "Kernel updated, reboot to load it" : undefined },
    packages: u,
    package_count: u.length,
  };
};
get("/api/vms/:id/updates", (m) => vmUpdates(m[1]));
get("/api/vms/:id/updates/summary", (m) => {
  const u = vmUpdates(m[1]);
  return { os: { current: u.os.current, available: u.os.available, status: u.os.status, checked: true }, packages: { total_updates: u.package_count, security_updates: u.packages.filter((p) => p.is_security_update).length }, kernel: { running: u.kernel.running, available: u.kernel.available, reboot_required: u.kernel.reboot_required, reboot_status: u.kernel.reboot_status } };
});
get("/api/vms/:id/updates/security", (m) => {
  const s = vmPackageUpdates(m[1]).filter((p) => p.is_security_update);
  return { updates: s, total: s.length, severity: { critical: s.filter((x) => x.severity === "CRITICAL").length, high: s.filter((x) => x.severity === "HIGH").length, medium: s.filter((x) => x.severity === "MEDIUM").length, low: 0, unknown: 0 } };
});
get("/api/vms/:id/updates/kernel", (m) => vmUpdates(m[1]).kernel);
get("/api/updates", () => {
  const rows = VMS.filter((v) => v.address).map((v) => {
    const u = vmPackageUpdates(v.id);
    return { vm_id: v.id, vm_name: v.name, os_status: vmUpdates(v.id).os.status, package_update_count: u.length, security_update_count: u.filter((p) => p.is_security_update).length, reboot_status: vmUpdates(v.id).kernel.reboot_status };
  });
  return { vms: rows, totals: { vms_with_updates: rows.length, security_updates: rows.reduce((a, r) => a + r.security_update_count, 0), package_updates: rows.reduce((a, r) => a + r.package_update_count, 0), os_updates: rows.filter((r) => r.os_status === "UPDATE_AVAILABLE").length, reboots_required: 1 } };
});
get("/api/vms/:id/update-plans", (m) => ({ plans: UPDATE_PLANS.filter((p) => p.vm_id === m[1]) }));
get("/api/update-plans/:id", (m) => {
  const plan = UPDATE_PLANS.find((p) => p.id === m[1]) ?? UPDATE_PLANS[0];
  const items = vmPackageUpdates(plan.vm_id ?? VMS[0].id).map((u) => ({ id: u.id, package_id: u.package_id, package_name: u.package_name, current_version: u.current_version, target_version: u.available_version, update_type: u.package_name.startsWith("linux-image") ? ("KERNEL" as const) : ("PACKAGE" as const), security_update: u.is_security_update, severity: u.severity }));
  return { plan, items, selected_count: items.length, security_update_count: items.filter((i) => i.security_update).length, kernel_update_count: 1, reboot_required: true, proposed_command: `sudo apt-get install --only-upgrade -y ${items.map((i) => i.package_name).join(" ")}`, executed: false };
});
get("/api/update-operations", () => ({ operations: UPDATE_OPERATIONS }));
get("/api/vms/:id/update-operations", (m) => ({ operations: UPDATE_OPERATIONS.filter((o) => o.vm_id === m[1]) }));
get("/api/update-operations/:id", (m) => UPDATE_OPERATIONS.find((o) => o.id === m[1]) ?? UPDATE_OPERATIONS[0]);
get("/api/update-operations/:id/logs", () => ({ logs: opLogs("update") }));
get("/api/update-operations/:id/steps", () => ({ steps: (["PRECHECK", "CONNECT", "REFRESH_METADATA", "UPDATE", "VERIFY", "DISCOVERY"] as const).map((step_type, i) => ({ step_number: i + 1, step_type, status: "SUCCESS", started_at: ago(140 - i), completed_at: ago(139.5 - i), output_summary: `${step_type.toLowerCase().replace("_", " ")} completed` })) }));
get("/api/update-operations/:id/results", () => ({ results: vmPackageUpdates(VMS[1].id).map((u) => ({ package_name: u.package_name, before_version: u.current_version, target_version: u.available_version, after_version: u.available_version, status: "VERIFIED" })) }));
get("/api/reboot-operations", () => ({ reboot_operations: REBOOT_OPERATIONS }));
get("/api/vms/:id/reboot-operations", (m) => ({ reboot_operations: REBOOT_OPERATIONS.filter((o) => o.vm_id === m[1]) }));
get("/api/reboot-operations/:id", (m) => REBOOT_OPERATIONS.find((o) => o.id === m[1]) ?? REBOOT_OPERATIONS[0]);
get("/api/reboot-operations/:id/logs", () => ({ logs: opLogs("reboot") }));
get("/api/reboot-operations/:id/results", () => ({ results: (["SSH", "BOOT_ID", "UPTIME", "OS", "KERNEL", "STORAGE", "DOCKER", "CONTAINERS"] as const).map((check_type) => ({ check_type, status: "VERIFIED", checked_at: ago(125), actual_value: check_type === "KERNEL" ? "5.15.0-119-generic" : undefined })) }));

// Docker (per VM)
get("/api/vms/:id/docker", (m) => {
  const on = vmById(m[1])?.docker_installed;
  return { daemon_status: on ? "RUNNING" : "NOT_INSTALLED", engine_version: on ? "27.1.1" : undefined, api_version: on ? "1.46" : undefined, cli_version: on ? "27.1.1" : undefined, info: on ? { OperatingSystem: vmById(m[1])?.os_name, NCPU: vmById(m[1])?.cpu_cores, Driver: "overlay2" } : undefined, last_scan: { status: "SUCCESS", container_count: 6, image_count: 9, network_count: 3, volume_count: 4, started_at: ago(5), completed_at: ago(4.9) } };
});
get("/api/vms/:id/docker/summary", (m) => {
  const c = vmContainers(m[1]);
  return { containers_total: c.length, containers_running: c.filter((x) => x.status === "RUNNING").length, containers_stopped: c.filter((x) => x.status === "EXITED").length, containers_unhealthy: c.filter((x) => x.health === "UNHEALTHY").length, images_total: 9, networks_total: 3, volumes_total: 4, last_scan: { status: "SUCCESS", started_at: ago(5), completed_at: ago(4.9) } };
});
get("/api/vms/:id/docker/containers", (m) => {
  const c = vmContainers(m[1]);
  return { containers: c, page: 1, page_size: 50, total: c.length };
});
get("/api/vms/:id/docker/containers/:cid", (m) => vmContainers(m[1]).find((c) => c.id === m[2]) ?? vmContainers(m[1])[0]);
get("/api/vms/:id/docker/images", (m) => {
  const imgs = containerSetFor(vmContainerIndex(m[1])).map((c, i) => ({ id: uid("26", i + 1), repository: c.image, tag: c.tag, image_id: `sha256:${(i + 7).toString(16).repeat(12)}`, size_bytes: (40 + i * 85) * MiB, created_at_remote: ago(60 * 24 * (15 + i)), last_discovered_at: ago(5) }));
  return { images: imgs, total: imgs.length };
});
get("/api/vms/:id/docker/networks", () => ({ networks: ["bridge", "host", "northwind-net"].map((name, i) => ({ id: uid("27", i + 1), network_id: (i + 3).toString(16).repeat(12), name, driver: name === "host" ? "host" : "bridge", scope: "local", internal: false, attachable: name === "northwind-net", created_at_remote: ago(60 * 24 * 60), last_discovered_at: ago(5) })), total: 3 }));
get("/api/vms/:id/docker/volumes", () => ({ volumes: ["pgdata", "redis-data", "uploads", "letsencrypt"].map((name, i) => ({ id: uid("28", i + 1), name, driver: "local", mountpoint: `/var/lib/docker/volumes/${name}/_data`, scope: "local", created_at_remote: ago(60 * 24 * 50), last_discovered_at: ago(5) })), total: 4 }));
get("/api/vms/:id/docker/metrics/current", (m) => {
  const idx = vmContainerIndex(m[1]);
  return { metrics: containerSetFor(idx).map((c, i) => ({ ...dockerMetric(idx, i), container_id: vmContainers(m[1])[i].id })).filter((_, i) => containerSetFor(idx)[i].status === "RUNNING") };
});
get("/api/vms/:id/docker/containers/:cid/metrics/current", (m) => {
  const idx = vmContainerIndex(m[1]);
  return { ...dockerMetric(idx, containerIndexById(idx, m[2])), container_id: m[2] };
});
get("/api/vms/:id/docker/containers/:cid/metrics/history", (m) => {
  const idx = vmContainerIndex(m[1]);
  const ci = containerIndexById(idx, m[2]);
  return { from: ago(60), to: ago(0), points: series(60, 1, (t) => { const d = dockerMetric(idx, ci, t); return { captured_at: d.captured_at, cpu_percent: d.cpu_percent, memory_usage_bytes: d.memory_usage_bytes, memory_percent: d.memory_percent, network_rx_bytes_per_sec: wave(ci, 40_000, 15_000, t), network_tx_bytes_per_sec: wave(ci + 1, 18_000, 6_000, t), block_read_bytes_per_sec: 1_200, block_write_bytes_per_sec: 4_800, pids: d.pids }; }) };
});

// Docker overview / hosts / access
get("/api/docker/overview", () => ({
  containers: VMS.filter((v) => v.docker_installed).slice(0, 3).flatMap((v) => {
    const idx = vmContainerIndex(v.id);
    return vmContainers(v.id).map((c, i) => ({ container_id: c.id, container_name: c.name, real_container_id: c.container_id, display_name: c.name, image: c.image, image_tag: c.image_tag, status: c.status, vm_resource_id: v.id, vm_name: v.name, workspace_name: v.workspace, created_at_remote: c.created_at_remote, metrics: c.status === "RUNNING" ? { ...dockerMetric(idx, i), container_id: c.id } : undefined }));
  }),
}));
get("/api/docker/containers/:cid/logs/search", (m, q) => logSearch(m[1].length, q));
get("/api/docker/access-grants", () => ({ grants: dockerAccessGrants() }));
get("/api/docker/my-access", () => ({ is_admin: true, grants: [] }));
get("/api/docker/hosts", () => ({ hosts: DOCKER_HOSTS }));
get("/api/docker/hosts/:id", (m) => DOCKER_HOSTS[dockerHostIndex(m[1])]);
get("/api/docker/hosts/:id/containers", (m) => {
  const c = hostContainers(dockerHostIndex(m[1]));
  return { containers: c, total: c.length, agent_connected: true };
});
get("/api/docker/hosts/:id/resources", (m): DockerHostResources => {
  const idx = dockerHostIndex(m[1]);
  const set = containerSetFor(idx);
  const images = set.map((c, i) => ({ id: `sha256:${(i + 3).toString(16).repeat(16)}`, repo_tags: [`${c.image}:${c.tag}`], size_bytes: (40 + i * 85) * MiB, containers: 1, created_at: ago(60 * 24 * (15 + i)) }));
  const volumes = ["pgdata", "redis-data", "uploads", "letsencrypt"].map((name, i) => ({ name, driver: "local", mountpoint: `/var/lib/docker/volumes/${name}/_data`, size_bytes: (i + 1) * 1.7 * GiB, created_at: ago(60 * 24 * 50) }));
  const build_cache = [0, 1, 2, 3].map((i) => ({ id: `bc${i}${"f".repeat(10)}`, type: i % 2 ? "regular" : "source.local", description: i % 2 ? "RUN npm ci" : "local source for context", size_bytes: (i + 1) * 210 * MiB, in_use: false, shared: i === 0, last_used_at: ago(60 * 24 * i) }));
  return { agent_connected: true, images, volumes, networks: ["bridge", "host", "none", "northwind-net"].map((name, i) => ({ id: (i + 5).toString(16).repeat(12), name, driver: name === "northwind-net" ? "bridge" : name, scope: "local", containers: name === "northwind-net" ? set.length : 0 })), build_cache, total_images_size_bytes: images.reduce((a, x) => a + x.size_bytes, 0), total_volumes_size_bytes: volumes.reduce((a, x) => a + (x.size_bytes ?? 0), 0), total_build_cache_size_bytes: build_cache.reduce((a, x) => a + x.size_bytes, 0) };
});
get("/api/docker/hosts/:id/system-metrics", (m): DockerHostSystemMetrics => {
  const i = dockerHostIndex(m[1]);
  return { agent_connected: true, available: true, cpu_percent: wave(i + 20, 34 + i * 10, 8), cpu_cores: 8, memory_total_bytes: 32 * GiB, memory_used_bytes: (14 + i * 4) * GiB, load_avg_1: 1.8 + i, load_avg_5: 1.6 + i, load_avg_15: 1.4 + i, disk_total_bytes: 500 * GiB, disk_used_bytes: (180 + i * 60) * GiB, disk_available_bytes: (320 - i * 60) * GiB };
});
get("/api/docker/hosts/:id/containers/:cid/logs/search", (m, q) => logSearch(dockerHostIndex(m[1]) + m[2].length, q));

// Kubernetes
get("/api/k8s/clusters", () => ({ clusters: K8S_CLUSTERS }));
get("/api/k8s/clusters/:id", (m) => K8S_CLUSTERS[clusterIndex(m[1])]);
get("/api/k8s/clusters/:id/nodes", (m) => ({ status: "ok", nodes: k8sNodes(clusterIndex(m[1])) }));
get("/api/k8s/clusters/:id/resources", (m) => {
  const r = k8sResources(clusterIndex(m[1]));
  return { status: "ok", namespaces: r.namespaces, nodes: r.node_count, pods: r.pods, deployments: r.deployments, stateful_sets: r.stateful_sets, daemon_sets: r.daemon_sets, services: r.services, persistent_volume_claims: r.persistent_volume_claims };
});
get("/api/k8s/overview", (_m, q) => {
  const only = q.get("cluster_resource_id");
  return { pods: K8S_CLUSTERS.flatMap((c, i) => (only && c.resource_id !== only ? [] : k8sPods(i))) };
});
get("/api/k8s/overview/clusters/:id/resources", (m) => k8sResources(clusterIndex(m[1])));
get("/api/k8s/pods/:id/logs/search", (m, q) => logSearch(m[1].length + 3, q));

// Dashboards & saved views
get("/api/saved-views", () => ({ views: [] }));
get("/api/saved-view-folders", () => ({ folders: [] }));
get("/api/monitoring-folders", (_m, q) => ({ folders: monitoringFolders().filter((f) => f.feature === q.get("feature") && (!q.get("workspace_id") || f.workspace_id === q.get("workspace_id"))) }));
get("/api/monitoring-folders/:id", (m) => monitoringFolders().find((f) => f.id === m[1]) ?? monitoringFolders()[0]);
get("/api/monitoring-dashboards", (_m, q) => ({ dashboards: monitoringDashboards().filter((d) => d.feature === q.get("feature") && (!q.get("monitoring_folder_id") || d.monitoring_folder_id === q.get("monitoring_folder_id")) && (!q.get("workspace_id") || d.workspace_id === q.get("workspace_id"))) }));
get("/api/monitoring-dashboards/:id", (m) => monitoringDashboards().find((d) => d.id === m[1]) ?? monitoringDashboards()[0]);

// Databases
get("/api/databases", () => ({ databases: DATABASES, total: DATABASES.length }));
get("/api/databases/performance", () => ({ databases: DATABASES.map((d) => { const p = databasePerformance(d.id); return { id: d.id, name: d.name, workspace_name: d.workspace_name, type: d.type, health: d.health, last_metric_at: d.last_metric_at, cache_hit_ratio: p.cache_hit_ratio, locks_blocked: p.locks?.blocked, replication_status: p.replication?.status, latency_p95_ms: p.latency_p95_ms }; }) }));
get("/api/databases/:id", (m) => databaseDetail(m[1]));
get("/api/databases/:id/access", () => ({ members: TEAM.slice(0, 3).map((u, i) => ({ id: u.id, name: u.name, email: u.email, view: true, performance: i < 2, browser: i === 0, logs: i < 2, query_details: i === 0, access_source: i === 0 ? "ADMIN" : "DIRECT" })) }));
get("/api/databases/:id/metrics/current", (m): DatabaseMetricsCurrent => {
  const d = DATABASES[databaseIndex(m[1])];
  const f = databaseMetricsFrame(m[1]);
  return { status: d.connection_status === "CONNECTED" ? "OK" : "FAILED", captured_at: f.captured_at, stale_after_seconds: 120, monitoring_enabled: true, connection_status: d.connection_status, health: d.health, metrics_status: f.metrics_status, common: f.common };
});
get("/api/databases/:id/metrics/history", (m) => ({ from: ago(60 * 24), to: ago(0), points: series(96, 15, (t) => { const f = databaseMetricsFrame(m[1], t); return { captured_at: f.captured_at, health_status: f.health, metrics_status: f.metrics_status, ...f.common }; }) }));
get("/api/databases/:id/performance", (m) => databasePerformance(m[1]));
get("/api/databases/:id/performance/history", (m) => {
  const i = databaseIndex(m[1]);
  return { from: ago(60 * 24), to: ago(0), points: series(96, 15, (t) => ({ captured_at: new Date(t).toISOString(), metrics_status: "OK", cache_hit_ratio: 0.93 + Math.sin(t / 3.6e6) * 0.02, locks_waiting: 0, locks_blocked: 0, replication_lag_seconds: wave(i, 0.6, 0.4, t), latency_p95_ms: wave(i, 18 + i * 6, 6, t), growth_bytes_per_day: 220 * MiB })) };
});
get("/api/databases/:id/queries", (m) => ({ queries: databasePerformance(m[1]).top_queries ?? [] }));
get("/api/databases/:id/queries/:fp", (m) => {
  const q = (databasePerformance(m[1]).top_queries ?? []).find((x) => x.fingerprint === decodeURIComponent(m[2])) ?? databasePerformance(m[1]).top_queries?.[0];
  return { query: q, first_seen_at: ago(60 * 24 * 20), history: series(48, 30, (t, i) => ({ captured_at: new Date(t).toISOString(), calls: 300 + i * 10, total_time_ms: 1500 + i * 40, avg_time_ms: q?.avg_time_ms })) };
});
get("/api/databases/:id/connections", (m) => ({ captured_at: ago(0.5), sessions: databasePerformance(m[1]).sessions }));
get("/api/databases/:id/locks", (m) => ({ captured_at: ago(0.5), locks: databasePerformance(m[1]).locks, sessions: databasePerformance(m[1]).sessions?.slice(1, 2) }));
get("/api/databases/:id/replication", (m) => ({ captured_at: ago(0.5), replication: databasePerformance(m[1]).replication }));
get("/api/databases/:id/monitoring-health", (m) => {
  const up = DATABASES[databaseIndex(m[1])].connection_status === "CONNECTED";
  return { tiers: ["fast", "deep", "storage"].map((tier) => ({ tier, last_success_at: up ? ago(0.5) : ago(42), last_failure_at: up ? undefined : ago(0.5), last_error: up ? undefined : "dial tcp 10.30.1.50:5432: i/o timeout", metrics_collected: up ? 2_880 : 0 })) };
});
get("/api/databases/:id/storage", (m) => ({ captured_at: ago(0.5), database_size_bytes: (18 + databaseIndex(m[1]) * 21) * GiB, growth_bytes_per_day: 220 * MiB }));
get("/api/databases/:id/storage/history", (m) => ({ from: ago(60 * 24 * 7), to: ago(0), points: series(56, 180, (t, i) => ({ captured_at: new Date(t).toISOString(), database_size_bytes: (18 + databaseIndex(m[1]) * 21) * GiB - (56 - i) * 40 * MiB })) }));
get("/api/databases/:id/catalog", (m) => ({ databases: [{ name: DATABASES[databaseIndex(m[1])].database_name ?? "app", connection_count: 42 }, { name: "postgres", connection_count: 2 }] }));
get("/api/databases/:id/schemas", () => ({ schemas: ["public", "billing", "audit"] }));
get("/api/databases/:id/tables", () => ({ tables: [["orders", 184_220, 1.2 * GiB], ["order_items", 612_400, 2.1 * GiB], ["customers", 58_300, 180 * MiB], ["products", 4_210, 22 * MiB], ["order_events", 1_902_300, 3.4 * GiB]].map(([name, row_count, size_bytes]) => ({ name: name as string, row_count: row_count as number, size_bytes: size_bytes as number })) }));
get("/api/databases/:id/tables/:t/columns", () => ({ columns: [{ name: "id", type: "bigint", nullable: false, default: "nextval('orders_id_seq')" }, { name: "customer_id", type: "bigint", nullable: false }, { name: "status", type: "text", nullable: false, default: "'pending'" }, { name: "total_cents", type: "integer", nullable: false }, { name: "currency", type: "char(3)", nullable: false, default: "'INR'" }, { name: "created_at", type: "timestamptz", nullable: false, default: "now()" }] }));
const sampleRows = (limit: number) => Array.from({ length: Math.min(limit, 25) }, (_, i) => ({ id: 184_220 - i, customer_id: 10_000 + ((i * 37) % 900), status: ["paid", "shipped", "pending", "delivered"][i % 4], total_cents: 49_900 + i * 1_250, currency: "INR", created_at: ago(i * 13) }));
get("/api/databases/:id/tables/:t/rows", (_m, q) => ({ rows: sampleRows(Number(q.get("limit") ?? 50)), total: 184_220, page_size: Number(q.get("limit") ?? 50), offset: Number(q.get("offset") ?? 0), has_more: true }));
get("/api/databases/:id/tables/:t/search", (_m, q) => ({ rows: sampleRows(5), total: 5, page_size: Number(q.get("limit") ?? 50), offset: 0, has_more: false }));
get("/api/databases/:id/tables/:t/indexes", () => ({ indexes: [{ name: "orders_pkey", columns: ["id"], is_unique: true, is_primary: true }, { name: "orders_customer_id_idx", columns: ["customer_id"], is_unique: false, is_primary: false }, { name: "orders_created_at_idx", columns: ["created_at"], is_unique: false, is_primary: false }] }));
get("/api/databases/:id/logs", () => ({ logs: series(40, 3, (t, i) => ({ timestamp: new Date(t).toISOString(), severity: i % 9 === 0 ? "WARNING" : i % 17 === 0 ? "ERROR" : "LOG", source: "postgres", message: i % 9 === 0 ? "duration: 1240.3 ms  statement: SELECT o.* FROM orders o JOIN order_items i ..." : i % 17 === 0 ? "FATAL: password authentication failed for user \"reporting\"" : "checkpoint complete: wrote 812 buffers (0.6%)" })).reverse(), has_more: false }));
get("/api/databases/:id/operations/capabilities", () => ({ capabilities: [
  { type: "CANCEL_QUERY", label: "Cancel query", destructive: false, reversible: "N/A", requires_target_id: true, impact_description: "Stops one running query; the session stays connected." },
  { type: "TERMINATE_SESSION", label: "Terminate session", destructive: true, reversible: "Not Available", requires_target_id: true, impact_description: "Disconnects one client session." },
  { type: "VACUUM", label: "VACUUM", destructive: false, reversible: "N/A", requires_target_id: false, impact_description: "Reclaims dead tuples; may add I/O load." },
  { type: "ANALYZE", label: "ANALYZE", destructive: false, reversible: "N/A", requires_target_id: false, impact_description: "Refreshes planner statistics." },
] }));
get("/api/databases/:id/operations", (m) => {
  const ops = databaseOperations().filter((o) => o.database_id === m[1]);
  return { operations: ops, total: ops.length };
});
get("/api/databases/:id/operations/:op", (m) => databaseOperations().find((o) => o.id === m[2]) ?? databaseOperations()[0]);
get("/api/databases/:id/operations/:op/logs", () => ({ logs: opLogs("database") }));
get("/api/database-operations", () => ({ operations: databaseOperations() }));

// Object storage
get("/api/object-storage", () => ({ storages: STORAGES, total: STORAGES.length }));
get("/api/object-storage/summary", () => ({ total: 3, healthy: 2, warning: 1, critical: 0, unavailable: 0 }));
get("/api/object-storage/:id", (m) => storageDetail(m[1]));
get("/api/object-storage/:id/metrics/current", (m) => {
  const s = STORAGES[storageIndex(m[1])];
  return { object_count: s.object_count, total_size_bytes: s.total_size_bytes, requests_per_min: wave(storageIndex(m[1]), 420, 120), error_count: 0, bucket_reachable: true, request_latency_ms: 38 + storageIndex(m[1]) * 9, captured_at: ago(1) };
});
get("/api/object-storage/:id/metrics/history", (m) => {
  const s = STORAGES[storageIndex(m[1])];
  return { points: series(48, 30, (t, i) => ({ captured_at: new Date(t).toISOString(), object_count: (s.object_count ?? 0) - (48 - i) * 40, total_size_bytes: (s.total_size_bytes ?? 0) - (48 - i) * 50 * MiB, requests_per_min: wave(i, 420, 120, t), request_latency_ms: 40, bucket_reachable: true })) };
});
get("/api/object-storage/:id/access", () => ({ members: TEAM.slice(0, 3).map((u, i) => ({ id: u.id, name: u.name, email: u.email, view: true, monitor: true, browser: i < 2, download: i === 0, access_source: i === 0 ? "ADMIN" : "WORKSPACE" })) }));
get("/api/object-storage/:id/objects", (m, q) => listObjects(STORAGES[storageIndex(m[1])].bucket, q.get("prefix") ?? ""));
get("/api/object-storage/:id/objects/search", (m, q) => {
  const res = listObjects(STORAGES[storageIndex(m[1])].bucket, q.get("prefix") ?? "");
  const term = (q.get("q") ?? "").toLowerCase();
  return { ...res, entries: res.entries.filter((e) => e.name.toLowerCase().startsWith(term)) };
});
get("/api/object-storage/:id/objects/prefix-size", (_m, q) => {
  const entries = OBJECT_TREE[q.get("prefix") ?? ""] ?? [];
  return { object_count: entries.length * 3, total_size_bytes: entries.reduce((a, e) => a + (e.size ?? 50 * MiB), 0), truncated: false };
});
get("/api/object-storage/:id/objects/metadata", (_m, q) => {
  const key = q.get("key") ?? "";
  const o = findObject(key);
  return { key, size_bytes: o?.size ?? 1024, content_type: o?.type ?? "application/octet-stream", etag: '"9b2cf535f27731c974343645a3985328"', last_modified: ago(60 * 24 * 3), storage_class: "STANDARD", metadata: { "uploaded-by": "storefront-web" } };
});
get("/api/object-storage/:id/objects/preview", (_m, q) => {
  const key = q.get("key") ?? "";
  const content = key.endsWith(".json") ? JSON.stringify({ version: 3, generated_at: ago(60), files: 184220 }, null, 2) : key.endsWith(".csv") ? "order_id,customer_id,total_inr,status\n184220,10417,499.00,paid\n184219,10388,1249.50,shipped\n" : "Northwind media bucket.\nThis is sample content in the Infra Hub Center demo.\n";
  return { content_type: findObject(key)?.type ?? "text/plain", encoding: "utf-8", content, truncated: false };
});

// Alerts & notifications
get("/api/alerts", (_m, q) => {
  let a = alerts();
  const status = q.get("status");
  if (status) a = a.filter((x) => x.status === status);
  const sev = q.get("severity");
  if (sev) a = a.filter((x) => x.severity === sev);
  const s = q.get("search")?.toLowerCase();
  if (s) a = a.filter((x) => x.title.toLowerCase().includes(s) || x.resource_name.toLowerCase().includes(s));
  const rid = q.get("resource_id");
  if (rid) a = a.filter((x) => x.resource_id === rid);
  return { alerts: a, total: a.length };
});
get("/api/alerts/summary", () => {
  const a = alerts();
  return { critical: a.filter((x) => x.severity === "CRITICAL" && x.status === "ACTIVE").length, warning: a.filter((x) => x.severity === "WARNING" && x.status !== "RESOLVED").length, info: a.filter((x) => x.severity === "INFO").length, active: a.filter((x) => x.status === "ACTIVE").length, acknowledged: a.filter((x) => x.status === "ACKNOWLEDGED").length, resolved_today: a.filter((x) => x.status === "RESOLVED").length };
});
get("/api/alerts/:id", (m) => alerts().find((a) => a.id === m[1]) ?? alerts()[0]);
get("/api/alerts/:id/history", (m) => {
  const a = alerts().find((x) => x.id === m[1]) ?? alerts()[0];
  return { events: [{ event_type: "CREATED", status: "ACTIVE", value: a.current_value, threshold: a.threshold, message: a.title, created_at: a.first_seen_at }, ...[1, 2, 3].map((i) => ({ event_type: "SAMPLE" as const, status: "ACTIVE", value: (a.current_value ?? 0) - i, threshold: a.threshold, created_at: ago(i * 5) })), ...(a.acknowledged_at ? [{ event_type: "ACKNOWLEDGED" as const, status: "ACKNOWLEDGED", message: `Acknowledged by ${a.acknowledged_by}`, created_at: a.acknowledged_at }] : [])] };
});
get("/api/alert-rules/templates", () => ({ templates: ALERT_TEMPLATES }));
get("/api/alert-rules", () => ({ alert_rules: alertRuleList() }));
get("/api/alert-rules/:id", (m) => ALERT_RULES.find((r) => r.id === m[1]) ?? ALERT_RULES[0]);
get("/api/resources/:id/alert-rules", (m) => ({ alert_rules: ALERT_RULES.filter((r) => r.resource_id === m[1]) }));
get("/api/notifications", (_m, q) => {
  let n = notifications();
  if (q.get("unread_only")) n = n.filter((x) => !x.read_at);
  return { notifications: n, unread_count: notifications().filter((x) => !x.read_at).length };
});
get("/api/notification-policies", () => ({ notification_policies: NOTIFICATION_POLICIES }));

// Monitoring, operations, audit
get("/api/monitoring/overview", () => monitoringOverview());
get("/api/monitoring/resources", (_m, q) => {
  let r = monitoringResources();
  const t = q.get("resource_type");
  if (t) r = r.filter((x) => x.resource_type === t);
  const h = q.get("health");
  if (h) r = r.filter((x) => x.health === h);
  const s = q.get("search")?.toLowerCase();
  if (s) r = r.filter((x) => x.name.toLowerCase().includes(s));
  return { resources: r, total: r.length };
});
get("/api/monitoring/timeline", () => {
  const ev = alerts().map((a) => ({ timestamp: a.first_seen_at, type: "ALERT_TRIGGERED" as const, resource_id: a.resource_id, resource_type: (a.resource_type === "DATABASE" ? "DATABASE" : "VM") as "VM" | "DATABASE", resource_name: a.resource_name, description: a.title, severity: a.severity }));
  const recs = recommendations().map((r) => ({ timestamp: r.detected_at, type: "RECOMMENDATION_DETECTED" as const, resource_id: r.resource_id, resource_type: (r.resource_type === "DATABASE" ? "DATABASE" : "VM") as "VM" | "DATABASE", resource_name: r.resource_name, description: r.title, severity: r.severity }));
  const all = [...ev, ...recs].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return { events: all, total: all.length };
});
get("/api/operations", () => {
  const o = unifiedOperations();
  return { operations: o, total: o.length };
});
get("/api/operations/summary", () => {
  const o = unifiedOperations();
  return { total: o.length, running: 0, pending_confirmation: o.filter((x) => x.status === "WAITING_CONFIRMATION").length, successful: o.filter((x) => x.status === "SUCCESS").length, failed: o.filter((x) => x.status === "FAILED").length, cancelled: 0 };
});
get("/api/audit-logs", (_m, q) => {
  let a = auditLogs();
  const c = q.get("category");
  if (c) a = a.filter((x) => x.category === c);
  const s = q.get("search")?.toLowerCase();
  if (s) a = a.filter((x) => x.action.includes(s));
  return { audit_logs: a, total: a.length };
});
get("/api/audit-logs/summary", () => ({ total: 11, today: 5, security_events: 2, user_changes: 1, resource_changes: 3, operations_events: 3 }));

export function demoGet(path: string): DemoResponse {
  const url = new URL(path, "http://demo.local");
  for (const [re, handler] of routes) {
    const m = url.pathname.match(re);
    if (m) {
      const body = handler(m, url.searchParams);
      return body === undefined ? notFound() : ok(body);
    }
  }
  return notFound();
}
