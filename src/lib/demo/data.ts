// Sample infrastructure for the public demo. Everything here is fictional
// (a made-up company, "Northwind Cloud") -- no real host, address or
// account appears anywhere. Types come straight from lib/api.ts, so the
// compiler checks every sample against exactly what the pages expect.

import type {
  Alert,
  AlertRule,
  AlertRuleListItem,
  AuditLogEntry,
  DatabaseListItem,
  DatabaseOperation,
  DockerAccessGrant,
  DockerContainer,
  DockerHost,
  DockerHostContainer,
  K8sCluster,
  K8sNode,
  K8sOverviewPod,
  MonitoringDashboard,
  MonitoringFolder,
  Notification,
  NotificationPolicy,
  ObjectStorageListItem,
  Package,
  PackageUpdate,
  RebootOperation,
  Recommendation,
  UnifiedOperation,
  UpdateOperation,
  UpdatePlan,
  UserListItem,
  VMDetail,
  Workspace,
} from "@/lib/api";

// ---------------------------------------------------------------- helpers

export function ago(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

// A smooth, repeatable "live" value: the same resource shows the same
// shape of curve, moving slowly over time.
export function wave(seed: number, base: number, amplitude: number, t = Date.now()): number {
  const x = t / 60_000 + seed * 7.3;
  const v = base + amplitude * (Math.sin(x / 3) * 0.6 + Math.sin(x / 1.7 + seed) * 0.3 + Math.sin(x * 1.3) * 0.1);
  return Math.round(Math.max(0, v) * 10) / 10;
}

const GiB = 1024 ** 3;
const MiB = 1024 ** 2;

function uid(prefix: string, n: number): string {
  // Stable UUID-shaped ids, e.g. 0d000000-0000-4000-8000-000000000001.
  return `${prefix.padEnd(8, "0").slice(0, 8)}-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

// ------------------------------------------------------------- workspaces

export const WORKSPACES: Workspace[] = [
  { id: uid("0a", 1), name: "Production", description: "Customer-facing services", is_active: true, vm_count: 5, database_count: 3, object_storage_count: 2, docker_host_count: 2, k8s_cluster_count: 1, member_count: 4 },
  { id: uid("0a", 2), name: "Staging", description: "Pre-release testing", is_active: true, vm_count: 2, database_count: 1, object_storage_count: 0, docker_host_count: 1, k8s_cluster_count: 1, member_count: 3 },
  { id: uid("0a", 3), name: "Analytics", description: "Data pipelines and reporting", is_active: true, vm_count: 2, database_count: 1, object_storage_count: 1, docker_host_count: 0, k8s_cluster_count: 0, member_count: 2 },
];
const [WS_PROD, WS_STAGE, WS_DATA] = WORKSPACES;

// ------------------------------------------------------------------ users

export const TEAM: UserListItem[] = [
  { id: uid("0b", 2), name: "Priya Sharma", email: "priya.sharma@northwind.example", role: "ADMIN", is_active: true, status: "ACTIVE", last_login_at: ago(35), created_at: ago(60 * 24 * 210) },
  { id: uid("0b", 3), name: "Daniel Kim", email: "daniel.kim@northwind.example", role: "MEMBER", is_active: true, status: "ACTIVE", last_login_at: ago(180), created_at: ago(60 * 24 * 150) },
  { id: uid("0b", 4), name: "Sofia Martinez", email: "sofia.martinez@northwind.example", role: "MEMBER", is_active: true, status: "ACTIVE", last_login_at: ago(60 * 26), created_at: ago(60 * 24 * 95) },
  { id: uid("0b", 5), name: "Arjun Patel", email: "arjun.patel@northwind.example", role: "MEMBER", is_active: true, status: "INVITED", created_at: ago(60 * 24 * 2) },
  { id: uid("0b", 6), name: "Emma Wilson", email: "emma.wilson@northwind.example", role: "MEMBER", is_active: false, status: "DISABLED", last_login_at: ago(60 * 24 * 40), created_at: ago(60 * 24 * 300) },
];

// -------------------------------------------------------------------- VMs

type VMSeed = {
  n: number;
  name: string;
  ws: Workspace;
  address: string;
  os: string;
  version: string;
  kernel: string;
  status: VMDetail["status"];
  cores: number;
  memGiB: number;
  diskGiB: number;
  pm: VMDetail["package_manager"];
  docker: boolean;
  agentOS?: string;
};

const VM_SEEDS: VMSeed[] = [
  { n: 1, name: "prod-web-01", ws: WS_PROD, address: "10.20.1.11", os: "Ubuntu", version: "22.04.4 LTS", kernel: "5.15.0-113-generic", status: "ONLINE", cores: 4, memGiB: 16, diskGiB: 160, pm: "APT", docker: true, agentOS: "linux" },
  { n: 2, name: "prod-web-02", ws: WS_PROD, address: "10.20.1.12", os: "Ubuntu", version: "22.04.4 LTS", kernel: "5.15.0-113-generic", status: "ONLINE", cores: 4, memGiB: 16, diskGiB: 160, pm: "APT", docker: true, agentOS: "linux" },
  { n: 3, name: "prod-api-01", ws: WS_PROD, address: "10.20.2.21", os: "Rocky Linux", version: "9.4", kernel: "5.14.0-427.el9.x86_64", status: "WARNING", cores: 8, memGiB: 32, diskGiB: 250, pm: "DNF", docker: true, agentOS: "linux" },
  { n: 4, name: "prod-db-proxy", ws: WS_PROD, address: "10.20.3.5", os: "Debian GNU/Linux", version: "12 (bookworm)", kernel: "6.1.0-21-amd64", status: "ONLINE", cores: 2, memGiB: 8, diskGiB: 80, pm: "APT", docker: false },
  { n: 5, name: "prod-queue-01", ws: WS_PROD, address: "10.20.4.8", os: "AlmaLinux", version: "9.4", kernel: "5.14.0-427.el9.x86_64", status: "ONLINE", cores: 4, memGiB: 16, diskGiB: 120, pm: "DNF", docker: true },
  { n: 6, name: "staging-app-01", ws: WS_STAGE, address: "10.30.1.10", os: "Ubuntu", version: "24.04 LTS", kernel: "6.8.0-40-generic", status: "ONLINE", cores: 2, memGiB: 8, diskGiB: 100, pm: "APT", docker: true, agentOS: "linux" },
  { n: 7, name: "staging-worker-01", ws: WS_STAGE, address: "10.30.1.21", os: "CentOS Stream", version: "9", kernel: "5.14.0-480.el9.x86_64", status: "OFFLINE", cores: 2, memGiB: 4, diskGiB: 60, pm: "YUM", docker: false },
  { n: 8, name: "analytics-etl-01", ws: WS_DATA, address: "10.40.1.15", os: "Red Hat Enterprise Linux", version: "9.4 (Plow)", kernel: "5.14.0-427.el9.x86_64", status: "ONLINE", cores: 16, memGiB: 64, diskGiB: 500, pm: "DNF", docker: true },
  // Agent-only machines (Host Metrics & Logs): no SSH address.
  { n: 9, name: "build-mac-01", ws: WS_DATA, address: "", os: "macOS", version: "14.5", kernel: "Darwin 23.5.0", status: "ONLINE", cores: 10, memGiB: 32, diskGiB: 1000, pm: "UNSUPPORTED", docker: false, agentOS: "darwin" },
  { n: 10, name: "win-reporting-01", ws: WS_PROD, address: "", os: "Windows Server", version: "2022 Datacenter", kernel: "10.0.20348", status: "ONLINE", cores: 4, memGiB: 16, diskGiB: 200, pm: "UNSUPPORTED", docker: false, agentOS: "windows" },
];

export const VMS: VMDetail[] = VM_SEEDS.map((s) => ({
  id: uid("0c", s.n),
  name: s.name,
  workspace: s.ws.name,
  workspace_id: s.ws.id,
  status: s.status,
  address: s.address,
  os_name: s.os,
  os_version: s.version,
  last_seen_at: s.status === "OFFLINE" ? ago(60 * 5) : ago(1),
  permissions: ["vm.view", "vm.connect", "vm.metrics", "vm.updates"],
  access_source: "ADMIN",
  agent_os: s.agentOS,
  agent_os_version: s.agentOS ? `${s.os} ${s.version}` : undefined,
  agent_kernel_version: s.agentOS ? s.kernel : undefined,
  agent_hostname: s.agentOS ? s.name : undefined,
  description: `${s.name} (${s.ws.name.toLowerCase()})`,
  hostname: s.name,
  username: s.address ? (s.os === "Ubuntu" ? "ubuntu" : "admin") : undefined,
  ssh_port: 22,
  kernel_version: s.kernel,
  architecture: s.os === "macOS" ? "arm64" : "x86_64",
  cpu_cores: s.cores,
  total_memory_bytes: s.memGiB * GiB,
  total_storage_bytes: s.diskGiB * GiB,
  docker_installed: s.docker,
  last_discovered_at: ago(45),
  monitoring_enabled: s.status !== "OFFLINE",
  package_manager: s.pm,
  ssh_key_credential_id: s.address ? uid("0d", s.ws === WS_PROD ? 1 : 2) : undefined,
  ssh_key_credential_name: s.address ? (s.ws === WS_PROD ? "prod-deploy-key" : "staging-key") : undefined,
}));

export function vmSeed(id: string): VMSeed | undefined {
  return VM_SEEDS.find((s) => uid("0c", s.n) === id);
}

// Deterministic per-VM load profile, used by every metrics endpoint.
export function vmLoad(id: string) {
  const s = vmSeed(id);
  const n = s?.n ?? 1;
  const hot = s?.status === "WARNING";
  return {
    seed: n,
    cpu: hot ? 88 : 18 + (n * 9) % 40,
    mem: 38 + (n * 13) % 40,
    disk: 30 + (n * 11) % 45,
    cores: s?.cores ?? 4,
    memTotal: (s?.memGiB ?? 16) * GiB,
    diskTotal: (s?.diskGiB ?? 100) * GiB,
    offline: s?.status === "OFFLINE",
  };
}

// ------------------------------------------------------------ Docker hosts

export const DOCKER_HOSTS: DockerHost[] = [
  { id: uid("0e", 1), resource_id: uid("0e", 101), name: "docker-prod-01", workspace_id: WS_PROD.id, workspace_name: WS_PROD.name, engine_version: "27.1.1", monitoring_enabled: true, last_connection_at: ago(0.5), agent_token_configured: true, agent_connected: true },
  { id: uid("0e", 2), resource_id: uid("0e", 102), name: "edge-gateway", workspace_id: WS_PROD.id, workspace_name: WS_PROD.name, engine_version: "26.1.4", monitoring_enabled: true, last_connection_at: ago(1), agent_token_configured: true, agent_connected: true },
  { id: uid("0e", 3), resource_id: uid("0e", 103), name: "docker-staging", workspace_id: WS_STAGE.id, workspace_name: WS_STAGE.name, engine_version: "27.0.3", monitoring_enabled: true, last_connection_at: ago(2), agent_token_configured: true, agent_connected: true },
];

type ContainerSeed = { name: string; image: string; tag: string; status: DockerContainer["status"]; health: DockerContainer["health"]; port?: number; cpu: number; memMiB: number };

const CONTAINER_SETS: ContainerSeed[][] = [
  [
    { name: "storefront-web", image: "northwind/storefront", tag: "3.8.2", status: "RUNNING", health: "HEALTHY", port: 3000, cpu: 12, memMiB: 420 },
    { name: "checkout-api", image: "northwind/checkout-api", tag: "2.14.0", status: "RUNNING", health: "HEALTHY", port: 8080, cpu: 22, memMiB: 610 },
    { name: "nginx-proxy", image: "nginx", tag: "1.27-alpine", status: "RUNNING", health: "HEALTHY", port: 443, cpu: 3, memMiB: 38 },
    { name: "redis-cache", image: "redis", tag: "7.2-alpine", status: "RUNNING", health: "HEALTHY", port: 6379, cpu: 4, memMiB: 150 },
    { name: "image-resizer", image: "northwind/image-resizer", tag: "1.3.1", status: "RUNNING", health: "UNHEALTHY", cpu: 64, memMiB: 980 },
    { name: "cron-reports", image: "northwind/cron-reports", tag: "0.9.4", status: "EXITED", health: "NO_HEALTHCHECK", cpu: 0, memMiB: 0 },
  ],
  [
    { name: "traefik", image: "traefik", tag: "v3.1", status: "RUNNING", health: "HEALTHY", port: 443, cpu: 6, memMiB: 90 },
    { name: "auth-service", image: "northwind/auth", tag: "1.22.0", status: "RUNNING", health: "HEALTHY", port: 9000, cpu: 9, memMiB: 260 },
    { name: "rate-limiter", image: "northwind/rate-limiter", tag: "0.6.0", status: "RUNNING", health: "STARTING", cpu: 2, memMiB: 64 },
  ],
  [
    { name: "storefront-web-staging", image: "northwind/storefront", tag: "3.9.0-rc1", status: "RUNNING", health: "HEALTHY", port: 3000, cpu: 5, memMiB: 380 },
    { name: "checkout-api-staging", image: "northwind/checkout-api", tag: "2.15.0-rc2", status: "RESTARTING", health: "UNHEALTHY", cpu: 1, memMiB: 120 },
    { name: "mailhog", image: "mailhog/mailhog", tag: "v1.0.1", status: "RUNNING", health: "NO_HEALTHCHECK", port: 8025, cpu: 1, memMiB: 24 },
    { name: "postgres-test", image: "postgres", tag: "16-alpine", status: "RUNNING", health: "HEALTHY", port: 5432, cpu: 3, memMiB: 210 },
  ],
];

function hexId(n: number): string {
  return (n * 2654435761).toString(16).padStart(8, "a").repeat(8).slice(0, 64);
}

// Containers for any Docker-capable VM or Docker host -- index picks a set.
export function containerSetFor(index: number): ContainerSeed[] {
  return CONTAINER_SETS[index % CONTAINER_SETS.length];
}

export function dockerHostIndex(id: string): number {
  const i = DOCKER_HOSTS.findIndex((h) => h.id === id || h.resource_id === id);
  return i < 0 ? 0 : i;
}

export function vmContainerIndex(vmId: string): number {
  return (vmSeed(vmId)?.n ?? 1) - 1;
}

export function hostContainers(index: number): DockerHostContainer[] {
  return containerSetFor(index).map((c, i) => {
    const running = c.status === "RUNNING" || c.status === "RESTARTING";
    return {
      container_id: hexId(index * 100 + i + 1),
      name: c.name,
      image: `${c.image}:${c.tag}`,
      status: c.status,
      state: c.status.toLowerCase(),
      health: c.health,
      command: c.image.startsWith("northwind/") ? "node server.js" : undefined,
      restart_count: c.status === "RESTARTING" ? 7 : i % 3,
      created_at_remote: ago(60 * 24 * (10 + i)),
      started_at_remote: running ? ago(60 * (20 + i * 7)) : undefined,
      first_seen_at: ago(60 * 24 * (9 + i)),
      metrics: running
        ? {
            cpu_percent: wave(index * 10 + i, c.cpu, Math.max(2, c.cpu * 0.3)),
            memory_usage_bytes: c.memMiB * MiB,
            memory_limit_bytes: 2048 * MiB,
            memory_percent: Math.round((c.memMiB / 2048) * 1000) / 10,
            network_rx_bytes: (i + 1) * 734 * MiB,
            network_tx_bytes: (i + 1) * 312 * MiB,
            block_read_bytes: (i + 1) * 88 * MiB,
            block_write_bytes: (i + 1) * 41 * MiB,
            pids: 6 + i * 3,
          }
        : undefined,
    };
  });
}

export function vmContainers(vmId: string): DockerContainer[] {
  const index = vmContainerIndex(vmId);
  return containerSetFor(index).map((c, i) => ({
    id: uid("0f", index * 100 + i + 1),
    container_id: hexId(index * 100 + i + 1),
    name: c.name,
    image: c.image,
    image_tag: c.tag,
    status: c.status,
    state: c.status.toLowerCase(),
    health: c.health,
    command: c.image.startsWith("northwind/") ? "node server.js" : undefined,
    restart_count: c.status === "RESTARTING" ? 7 : i % 3,
    platform: "linux",
    ports: c.port ? [{ container_port: c.port, protocol: "tcp", host_ip: "0.0.0.0", host_port: c.port }] : [],
    mounts: [{ source: `/var/lib/northwind/${c.name}`, destination: "/data", read_only: false, type: "bind" }],
    created_at_remote: ago(60 * 24 * (10 + i)),
    started_at_remote: c.status === "RUNNING" ? ago(60 * (20 + i * 7)) : undefined,
    last_discovered_at: ago(2),
    networks: [{ network_name: "northwind-net", driver: "bridge", ip_address: `172.18.0.${i + 2}`, gateway: "172.18.0.1" }],
  }));
}

// ---------------------------------------------------------------- K8s

export const K8S_CLUSTERS: K8sCluster[] = [
  { id: uid("10", 1), resource_id: uid("10", 101), name: "prod-eks", workspace_id: WS_PROD.id, workspace_name: WS_PROD.name, kubernetes_version: "v1.30.2-eks", monitoring_enabled: true, connection_status: "CONNECTED", last_connection_at: ago(0.5), last_discovered_at: ago(1), agent_token_configured: true, agent_connected: true },
  { id: uid("10", 2), resource_id: uid("10", 102), name: "staging-k3s", workspace_id: WS_STAGE.id, workspace_name: WS_STAGE.name, kubernetes_version: "v1.29.6+k3s2", monitoring_enabled: true, connection_status: "CONNECTED", last_connection_at: ago(1), last_discovered_at: ago(2), agent_token_configured: true, agent_connected: true },
];

export function clusterIndex(id: string): number {
  const i = K8S_CLUSTERS.findIndex((c) => c.id === id || c.resource_id === id);
  return i < 0 ? 0 : i;
}

export function k8sNodes(index: number): K8sNode[] {
  const count = index === 0 ? 3 : 2;
  return Array.from({ length: count }, (_, i) => {
    const cpuCap = index === 0 ? 4000 : 2000;
    const memCap = (index === 0 ? 16 : 8) * GiB;
    const cpuPct = wave(index * 5 + i, 35 + i * 12, 10);
    const memPct = wave(index * 5 + i + 2, 55 + i * 8, 6);
    return {
      name: index === 0 ? `ip-10-50-${i + 1}-${20 + i}.ec2.internal` : `k3s-node-${i + 1}`,
      ready: true,
      roles: i === 0 && index === 1 ? ["control-plane", "master"] : ["worker"],
      kubelet_version: K8S_CLUSTERS[index].kubernetes_version,
      os_image: index === 0 ? "Amazon Linux 2023" : "Ubuntu 22.04.4 LTS",
      cpu_capacity_millicores: cpuCap,
      cpu_allocatable_millicores: cpuCap - 100,
      cpu_usage_millicores: Math.round((cpuCap * cpuPct) / 100),
      cpu_usage_percent: cpuPct,
      memory_capacity_bytes: memCap,
      memory_allocatable_bytes: memCap - 512 * MiB,
      memory_usage_bytes: Math.round((memCap * memPct) / 100),
      memory_usage_percent: memPct,
      storage_capacity_bytes: 100 * GiB,
      storage_usage_bytes: (30 + i * 9) * GiB,
      storage_usage_percent: 30 + i * 9,
      pod_capacity: 110,
      pod_count: 14 + i * 5,
    };
  });
}

const POD_SEEDS: { ns: string; app: string; replicas: number; phase?: K8sOverviewPod["phase"]; restarts?: number }[] = [
  { ns: "storefront", app: "storefront-web", replicas: 3 },
  { ns: "storefront", app: "checkout-api", replicas: 2 },
  { ns: "payments", app: "payments-gateway", replicas: 2, restarts: 4 },
  { ns: "search", app: "search-indexer", replicas: 1, phase: "PENDING" },
  { ns: "monitoring", app: "node-exporter", replicas: 2 },
  { ns: "ingress-nginx", app: "ingress-nginx-controller", replicas: 1 },
  { ns: "batch", app: "nightly-export", replicas: 1, phase: "FAILED", restarts: 3 },
];

// "<app>-<replicaset hash>-<5 chars>", from the vowel-free alphabet
// Kubernetes uses -- so the dashboard picker groups replicas by app.
const K8S_ALPHABET = "bcdfghjklmnpqrstvwxz2456789";
function k8sSuffix(seed: number, length: number): string {
  let out = "";
  let x = seed * 2654435761;
  for (let i = 0; i < length; i++) {
    x = (x * 1103515245 + 12345) % 2147483648;
    out += K8S_ALPHABET[x % K8S_ALPHABET.length];
  }
  return out;
}

export function k8sPods(index: number): K8sOverviewPod[] {
  const cluster = K8S_CLUSTERS[index];
  const nodes = k8sNodes(index);
  const pods: K8sOverviewPod[] = [];
  let n = 0;
  for (const p of POD_SEEDS) {
    for (let r = 0; r < (index === 0 ? p.replicas : 1); r++) {
      n++;
      const phase = p.phase ?? "RUNNING";
      pods.push({
        pod_id: uid("11", index * 1000 + n),
        namespace: index === 0 ? p.ns : `${p.ns}-staging`,
        pod_name: `${p.app}-${k8sSuffix(index * 100 + POD_SEEDS.indexOf(p) + 1, 10)}-${k8sSuffix(index * 1000 + n + 7, 5)}`,
        display_name: p.app,
        node_name: nodes[n % nodes.length].name,
        phase,
        ready_containers: phase === "RUNNING" ? 1 : 0,
        total_containers: 1,
        restart_count: p.restarts ?? 0,
        cpu_usage_millicores: phase === "RUNNING" ? Math.round(wave(n, 120, 60)) : 0,
        memory_usage_bytes: phase === "RUNNING" ? (180 + n * 23) * MiB : 0,
        started_at: ago(60 * (5 + n * 3)),
        last_discovered_at: ago(1),
        cluster_resource_id: cluster.resource_id,
        cluster_name: cluster.name,
        workspace_name: cluster.workspace_name,
      });
    }
  }
  return pods;
}

// ---------------------------------------------------------------- databases

export const DATABASES: DatabaseListItem[] = [
  { id: uid("12", 1), resource_id: uid("12", 101), name: "orders-postgres", workspace_id: WS_PROD.id, workspace_name: WS_PROD.name, type: "POSTGRESQL", provider: "AWS RDS", host: "orders.cluster-demo.us-east-1.rds.example", port: 5432, database_name: "orders", monitoring_enabled: true, connection_status: "CONNECTED", health: "HEALTHY", last_metric_at: ago(0.5) },
  { id: uid("12", 2), resource_id: uid("12", 102), name: "sessions-redis", workspace_id: WS_PROD.id, workspace_name: WS_PROD.name, type: "REDIS", provider: "Self-hosted", host: "10.20.3.40", port: 6379, monitoring_enabled: true, connection_status: "CONNECTED", health: "HEALTHY", last_metric_at: ago(0.5) },
  { id: uid("12", 3), resource_id: uid("12", 103), name: "catalog-mysql", workspace_id: WS_PROD.id, workspace_name: WS_PROD.name, type: "MYSQL", provider: "Google Cloud SQL", host: "10.20.3.41", port: 3306, database_name: "catalog", monitoring_enabled: true, connection_status: "CONNECTED", health: "WARNING", last_metric_at: ago(1) },
  { id: uid("12", 4), resource_id: uid("12", 104), name: "events-mongodb", workspace_id: WS_DATA.id, workspace_name: WS_DATA.name, type: "MONGODB", provider: "MongoDB Atlas", host: "events-shard-00.demo.mongodb.example", port: 27017, database_name: "events", monitoring_enabled: true, connection_status: "CONNECTED", health: "HEALTHY", last_metric_at: ago(1) },
  { id: uid("12", 5), resource_id: uid("12", 105), name: "staging-postgres", workspace_id: WS_STAGE.id, workspace_name: WS_STAGE.name, type: "POSTGRESQL", provider: "Self-hosted", host: "10.30.1.50", port: 5432, database_name: "app_staging", monitoring_enabled: true, connection_status: "TIMEOUT", health: "CRITICAL", last_metric_at: ago(42) },
];

export function databaseIndex(id: string): number {
  const i = DATABASES.findIndex((d) => d.id === id || d.resource_id === id);
  return i < 0 ? 0 : i;
}

// ---------------------------------------------------------------- object storage

export const STORAGES: ObjectStorageListItem[] = [
  { id: uid("13", 1), resource_id: uid("13", 101), name: "media-assets", workspace_id: WS_PROD.id, workspace_name: WS_PROD.name, provider: "AWS_S3", bucket: "northwind-media-assets", region: "us-east-1", monitoring_enabled: true, connection_status: "CONNECTED", health_status: "HEALTHY", object_count: 184_220, total_size_bytes: 412 * GiB, last_checked_at: ago(3), permissions: ["object_storage.view", "object_storage.monitor", "object_storage.browser", "object_storage.download"] },
  { id: uid("13", 2), resource_id: uid("13", 102), name: "db-backups", workspace_id: WS_PROD.id, workspace_name: WS_PROD.name, provider: "MINIO", bucket: "db-backups", endpoint: "https://minio.northwind.example", monitoring_enabled: true, connection_status: "CONNECTED", health_status: "WARNING", object_count: 2_914, total_size_bytes: 1_860 * GiB, last_checked_at: ago(4), permissions: ["object_storage.view", "object_storage.monitor", "object_storage.browser", "object_storage.download"] },
  { id: uid("13", 3), resource_id: uid("13", 103), name: "logs-archive", workspace_id: WS_DATA.id, workspace_name: WS_DATA.name, provider: "DIGITALOCEAN_SPACES", bucket: "nw-logs-archive", region: "nyc3", endpoint: "https://nyc3.digitaloceanspaces.com", monitoring_enabled: true, connection_status: "CONNECTED", health_status: "HEALTHY", object_count: 96_031, total_size_bytes: 238 * GiB, last_checked_at: ago(5), permissions: ["object_storage.view", "object_storage.monitor", "object_storage.browser", "object_storage.download"] },
];

export function storageIndex(id: string): number {
  const i = STORAGES.findIndex((s) => s.id === id || s.resource_id === id);
  return i < 0 ? 0 : i;
}

// ---------------------------------------------------------------- packages

const PACKAGE_SEEDS: [string, string, string | null, boolean, Package["severity"]][] = [
  ["openssl", "3.0.2-0ubuntu1.15", "3.0.2-0ubuntu1.18", true, "HIGH"],
  ["openssh-server", "1:8.9p1-3ubuntu0.7", "1:8.9p1-3ubuntu0.10", true, "CRITICAL"],
  ["curl", "7.81.0-1ubuntu1.15", "7.81.0-1ubuntu1.17", true, "MEDIUM"],
  ["nginx", "1.18.0-6ubuntu14.4", "1.18.0-6ubuntu14.5", false, "LOW"],
  ["linux-image-generic", "5.15.0.113.113", "5.15.0.119.119", true, "HIGH"],
  ["python3.10", "3.10.12-1~22.04.3", "3.10.12-1~22.04.5", true, "MEDIUM"],
  ["docker-ce", "5:27.1.1-1~ubuntu.22.04", null, false, undefined],
  ["git", "1:2.34.1-1ubuntu1.11", null, false, undefined],
  ["htop", "3.0.5-7build2", null, false, undefined],
  ["vim", "2:8.2.3995-1ubuntu2.17", "2:8.2.3995-1ubuntu2.19", false, "LOW"],
  ["tzdata", "2024a-0ubuntu0.22.04", "2024b-0ubuntu0.22.04", false, "LOW"],
  ["systemd", "249.11-0ubuntu3.12", null, false, undefined],
  ["ca-certificates", "20230311ubuntu0.22.04.1", null, false, undefined],
  ["libc6", "2.35-0ubuntu3.7", "2.35-0ubuntu3.8", true, "HIGH"],
  ["sudo", "1.9.9-1ubuntu2.4", null, false, undefined],
];

export function vmPackages(vmId: string): Package[] {
  const s = vmSeed(vmId);
  const pm = s?.pm === "APT" ? "APT" : "DNF";
  return PACKAGE_SEEDS.map(([name, installed, available, security, severity], i) => ({
    id: uid("14", (s?.n ?? 1) * 100 + i + 1),
    name,
    installed_version: installed,
    available_version: available ?? undefined,
    architecture: "amd64",
    package_manager: pm,
    description: `${name} package`,
    status: available ? (security ? "SECURITY_UPDATE" : "UPDATE_AVAILABLE") : "UP_TO_DATE",
    severity,
    is_security_update: security,
    last_discovered_at: ago(50),
    created_at: ago(60 * 24 * 60),
    installed_at: ago(60 * 24 * (90 - i * 4)),
  }));
}

export function vmPackageUpdates(vmId: string): PackageUpdate[] {
  return vmPackages(vmId)
    .filter((p) => p.available_version)
    .map((p, i) => ({
      id: uid("15", Number(p.id.slice(-6)) + i),
      package_id: p.id,
      package_name: p.name,
      current_version: p.installed_version,
      available_version: p.available_version ?? "",
      architecture: p.architecture,
      severity: p.severity ?? "UNKNOWN",
      is_security_update: p.is_security_update,
      security_status: p.is_security_update ? "CONFIRMED" : "NOT_SECURITY",
      recommendation_status: i === 0 ? "ACKNOWLEDGED" : "NEW",
      detected_at: ago(60 * (4 + i)),
    }));
}

// ---------------------------------------------------------------- alerts

export const ALERT_RULES: AlertRule[] = [
  { id: uid("16", 1), resource_id: VMS[2].id, alert_type: "VM_HIGH_CPU", metric: "cpu_usage_percent", condition: ">", threshold: 85, recovery_threshold: 75, duration_seconds: 300, severity: "CRITICAL", notification_policy_id: uid("17", 1), enabled: true, created_at: ago(60 * 24 * 30) },
  { id: uid("16", 2), resource_id: VMS[0].id, alert_type: "VM_HIGH_MEMORY", metric: "memory_usage_percent", condition: ">", threshold: 90, duration_seconds: 300, severity: "WARNING", notification_policy_id: uid("17", 1), enabled: true, created_at: ago(60 * 24 * 28) },
  { id: uid("16", 3), resource_id: VMS[7].id, alert_type: "VM_HIGH_DISK", metric: "storage_usage_percent", condition: ">", threshold: 80, duration_seconds: 600, severity: "WARNING", notification_policy_id: uid("17", 2), enabled: true, created_at: ago(60 * 24 * 20) },
  { id: uid("16", 4), resource_id: DATABASES[2].resource_id, alert_type: "DATABASE_HIGH_CONNECTIONS", metric: "connections_percent", condition: ">", threshold: 70, duration_seconds: 300, severity: "WARNING", notification_policy_id: uid("17", 1), enabled: true, created_at: ago(60 * 24 * 14) },
  { id: uid("16", 5), resource_id: DATABASES[4].resource_id, alert_type: "DATABASE_UNAVAILABLE", metric: "availability", condition: "==", threshold: 0, duration_seconds: 120, severity: "CRITICAL", notification_policy_id: uid("17", 1), enabled: true, created_at: ago(60 * 24 * 10) },
  { id: uid("16", 6), resource_id: DOCKER_HOSTS[0].resource_id, alert_type: "DOCKER_HOST_CONTAINER_HIGH_CPU", metric: "cpu_percent", condition: ">", threshold: 50, duration_seconds: 300, severity: "WARNING", notification_policy_id: uid("17", 2), enabled: true, created_at: ago(60 * 24 * 7) },
  { id: uid("16", 7), resource_id: K8S_CLUSTERS[0].resource_id, alert_type: "K8S_POD_RESTARTS", metric: "restart_count", condition: ">", threshold: 3, duration_seconds: 600, severity: "WARNING", enabled: false, created_at: ago(60 * 24 * 5) },
  // Log Explorer rules: a whole log dashboard, one alert per app/container.
  { id: uid("16", 8), resource_id: K8S_CLUSTERS[0].resource_id, monitoring_dashboard_id: uid("20", 4), alert_type: "K8S_LOGS_POD_PROBLEM", metric: "K8S_POD_PROBLEM_COUNT", condition: ">=", threshold: 1, duration_seconds: 600, severity: "CRITICAL", notification_policy_id: uid("17", 1), enabled: true, match_options: { k8s_problems: [], log_lines: 20 }, created_at: ago(60 * 24 * 3) },
  { id: uid("16", 9), resource_id: K8S_CLUSTERS[0].resource_id, monitoring_dashboard_id: uid("20", 4), alert_type: "K8S_LOGS_ERROR_LINES", metric: "LOG_MATCH_COUNT", condition: ">=", threshold: 3, duration_seconds: 300, severity: "WARNING", notification_policy_id: uid("17", 1), enabled: true, match_options: { log_categories: ["SUSPICIOUS_ACTIVITY", "AUTH_SECURITY"], log_lines: 20 }, created_at: ago(60 * 24 * 3) },
  { id: uid("16", 10), resource_id: VMS[0].id, monitoring_dashboard_id: uid("20", 3), alert_type: "DOCKER_LOGS_CONTAINER_EXITED", metric: "CONTAINER_EXITED", condition: "==", threshold: 1, duration_seconds: 0, severity: "CRITICAL", notification_policy_id: uid("17", 1), enabled: true, match_options: { only_unexpected_exits: true, log_lines: 20 }, created_at: ago(60 * 24 * 2) },
];

// Which log dashboard a Log Explorer rule watches (alert rules list).
const RULE_DASHBOARDS: Record<string, { name: string; feature: "DOCKER_LOGS" | "K8S_LOGS" }> = {
  [uid("20", 3)]: { name: "checkout-api logs", feature: "DOCKER_LOGS" },
  [uid("20", 4)]: { name: "payments-gateway logs", feature: "K8S_LOGS" },
};

const RULE_RESOURCES: Record<string, { name: string; type: string; ws: string }> = Object.fromEntries([
  ...VMS.map((v) => [v.id, { name: v.name, type: "VM", ws: v.workspace_id }]),
  ...DATABASES.map((d) => [d.resource_id, { name: d.name ?? "", type: "DATABASE", ws: d.workspace_id ?? "" }]),
  ...DOCKER_HOSTS.map((h) => [h.resource_id, { name: h.name, type: "DOCKER_HOST", ws: h.workspace_id }]),
  ...K8S_CLUSTERS.map((c) => [c.resource_id, { name: c.name, type: "K8S_CLUSTER", ws: c.workspace_id }]),
  ...STORAGES.map((s) => [s.resource_id, { name: s.name, type: "OBJECT_STORAGE", ws: s.workspace_id ?? "" }]),
]);

export function resourceInfo(resourceId: string) {
  return RULE_RESOURCES[resourceId];
}

export function alertRuleList(): AlertRuleListItem[] {
  return ALERT_RULES.map((rule) => {
    const r = RULE_RESOURCES[rule.resource_id];
    const d = rule.monitoring_dashboard_id ? RULE_DASHBOARDS[rule.monitoring_dashboard_id] : undefined;
    return {
      rule, resource_name: r?.name ?? "", resource_type: r?.type ?? "VM", workspace_id: r?.ws ?? WS_PROD.id,
      ...(d ? { monitoring_dashboard_name: d.name, monitoring_dashboard_feature: d.feature } : {}),
    };
  });
}

export function alerts(): Alert[] {
  const payPod = (() => {
    const p = k8sPods(0).find((x) => x.namespace === "payments");
    return p ? `payments/${p.pod_name}` : "payments/payments-gateway";
  })();
  const mk = (n: number, a: Partial<Alert> & Pick<Alert, "resource_id" | "alert_type" | "severity" | "status" | "metric" | "threshold" | "title">, minutes: number): Alert => {
    const r = RULE_RESOURCES[a.resource_id];
    return {
      id: uid("18", n),
      alert_rule_id: ALERT_RULES[Math.min(n - 1, ALERT_RULES.length - 1)].id,
      resource_name: r?.name ?? "",
      resource_type: r?.type ?? "VM",
      workspace_id: r?.ws,
      workspace_name: WORKSPACES.find((w) => w.id === r?.ws)?.name,
      first_seen_at: ago(minutes),
      last_seen_at: a.status === "RESOLVED" ? ago(minutes - 20) : ago(1),
      created_at: ago(minutes),
      duration_seconds: minutes * 60,
      ...a,
    };
  };
  return [
    mk(1, { resource_id: VMS[2].id, alert_type: "VM_HIGH_CPU", severity: "CRITICAL", status: "ACTIVE", metric: "cpu_usage_percent", current_value: wave(3, 91, 4), threshold: 85, title: "High CPU on prod-api-01", description: "CPU usage has been above 85% for more than 5 minutes." }, 38),
    mk(2, { resource_id: DATABASES[4].resource_id, alert_type: "DATABASE_UNAVAILABLE", severity: "CRITICAL", status: "ACTIVE", metric: "availability", current_value: 0, threshold: 0, title: "staging-postgres is unreachable", description: "Connection attempts are timing out." }, 42),
    mk(3, { resource_id: DATABASES[2].resource_id, alert_type: "DATABASE_HIGH_CONNECTIONS", severity: "WARNING", status: "ACKNOWLEDGED", metric: "connections_percent", current_value: 76, threshold: 70, title: "catalog-mysql connections above 70%", description: "76% of max_connections are in use.", acknowledged_by: "Priya Sharma", acknowledged_at: ago(15) }, 70),
    mk(4, { resource_id: DOCKER_HOSTS[0].resource_id, alert_type: "DOCKER_HOST_CONTAINER_HIGH_CPU", severity: "WARNING", status: "ACTIVE", metric: "cpu_percent", current_value: 64, threshold: 50, title: "image-resizer container CPU above 50%", container_name: "image-resizer" }, 22),
    mk(5, { resource_id: VMS[7].id, alert_type: "VM_HIGH_DISK", severity: "WARNING", status: "RESOLVED", metric: "storage_usage_percent", current_value: 78, threshold: 80, title: "Disk usage on analytics-etl-01", resolved_at: ago(200) }, 300),
    mk(6, { resource_id: VMS[0].id, alert_type: "VM_HIGH_MEMORY", severity: "INFO", status: "SUPPRESSED", metric: "memory_usage_percent", current_value: 91, threshold: 90, title: "Memory pressure on prod-web-01", suppressed_at: ago(50), suppressed_reason: "Planned load test" }, 90),
    mk(7, {
      resource_id: K8S_CLUSTERS[0].resource_id, alert_rule_id: uid("16", 8), alert_type: "K8S_LOGS_POD_PROBLEM", severity: "CRITICAL", status: "ACTIVE",
      metric: "K8S_POD_PROBLEM_COUNT", current_value: 2, threshold: 1, title: `payments-gateway logs: Kubernetes pod problem — ${payPod}`,
      subject_label: payPod,
      description: `Pod ${payPod} on ip-10-0-2-41 (Running, 4 restarts): crash loop, out of memory (OOMKilled), restarted. CrashLoopBackOff (container gateway): back-off 2m40s restarting failed container=gateway. OOMKilled (container gateway) exit code 137.`,
      log_excerpt: [
        `now  WAITING  CrashLoopBackOff (container gateway): back-off 2m40s restarting failed container=gateway`,
        `${ago(12)}  LAST_TERMINATED  OOMKilled (container gateway) exit code 137`,
        `--- last 6 log lines before the container stopped ---`,
        `${ago(12)}  INFO  settlement batch 4411 started (2,000 transactions)`,
        `${ago(12)}  INFO  loading merchant ledger into memory`,
        `${ago(12)}  WARN  heap usage 92% (limit 512Mi)`,
        `${ago(12)}  WARN  heap usage 98% (limit 512Mi)`,
        `${ago(12)}  ERROR allocation failed: cannot reserve 64MiB`,
        `${ago(12)}  fatal error: runtime: out of memory`,
      ].join("\n"),
    }, 12),
    mk(8, {
      resource_id: K8S_CLUSTERS[0].resource_id, alert_rule_id: uid("16", 9), alert_type: "K8S_LOGS_ERROR_LINES", severity: "WARNING", status: "ACTIVE",
      metric: "LOG_MATCH_COUNT", current_value: 7, threshold: 3, title: `payments-gateway logs: Errors or suspicious activity in pod logs — ${payPod}`,
      subject_label: payPod,
      description: `7 matching log lines (suspicious activity, auth failures) in the last 5 minutes from ${payPod}.`,
      log_excerpt: [
        `${ago(4)}  authentication failed for user 'admin' from 203.0.113.7`,
        `${ago(4)}  authentication failed for user 'root' from 203.0.113.7`,
        `${ago(3)}  GET /api/v1/../../etc/passwd 404 from 203.0.113.7`,
        `${ago(3)}  GET /.env 404 from 203.0.113.7`,
        `${ago(2)}  POST /api/v1/charges?id=1 UNION SELECT card_number FROM cards 400 from 203.0.113.7`,
        `${ago(2)}  invalid token for client 'mobile-app' from 203.0.113.7`,
        `${ago(1)}  too many failed login attempts for 'admin', locking for 15m`,
      ].join("\n"),
    }, 4),
    mk(9, {
      resource_id: VMS[0].id, alert_rule_id: uid("16", 10), alert_type: "DOCKER_LOGS_CONTAINER_EXITED", severity: "CRITICAL", status: "ACKNOWLEDGED",
      metric: "CONTAINER_EXITED", current_value: 1, threshold: 1, title: "checkout-api logs: Container stopped — checkout-api",
      subject_label: "checkout-api", acknowledged_by: "Priya Sharma", acknowledged_at: ago(25),
      description: "Container checkout-api stopped with exit code 1 (application error).",
      log_excerpt: [
        `${ago(31)}  INFO  checkout-api 2.14.0 starting`,
        `${ago(31)}  INFO  connecting to postgres at catalog-db:5432`,
        `${ago(31)}  WARN  postgres connection attempt 1/3 failed: connection refused`,
        `${ago(31)}  WARN  postgres connection attempt 2/3 failed: connection refused`,
        `${ago(31)}  ERROR postgres connection attempt 3/3 failed: connection refused`,
        `${ago(31)}  FATAL cannot start without a database, exiting`,
      ].join("\n"),
    }, 31),
  ];
}

export const NOTIFICATION_POLICIES: NotificationPolicy[] = [
  { id: uid("17", 1), name: "On-call (Slack + Email)", is_default: true, info_channels: ["IN_APP"], warning_channels: ["IN_APP", "SLACK"], critical_channels: ["IN_APP", "SLACK", "EMAIL", "TEAMS"], quiet_hours_start: "22:00", quiet_hours_end: "07:00", quiet_hours_timezone: "UTC", slack_webhook_url: "https://hooks.slack.com/services/T000/B000/XXXX", teams_webhook_url: "https://example.webhook.office.com/webhookb2/demo", created_at: ago(60 * 24 * 60) },
  { id: uid("17", 2), name: "Platform team (Teams)", is_default: false, info_channels: ["IN_APP"], warning_channels: ["IN_APP", "TEAMS"], critical_channels: ["IN_APP", "TEAMS", "WEBHOOK"], webhook_url: "https://hooks.northwind.example/infra", teams_webhook_url: "https://example.webhook.office.com/webhookb2/platform", created_at: ago(60 * 24 * 30) },
];

export function notifications(): Notification[] {
  const a = alerts();
  return [
    { id: uid("19", 1), alert_id: a[0].id, category: "CRITICAL_ALERT", channel: "IN_APP", severity: "CRITICAL", title: a[0].title, body: a[0].description, status: "SENT", created_at: ago(38) },
    { id: uid("19", 2), alert_id: a[1].id, category: "CRITICAL_ALERT", channel: "IN_APP", severity: "CRITICAL", title: a[1].title, body: a[1].description, status: "SENT", created_at: ago(42) },
    { id: uid("19", 3), alert_id: a[3].id, category: "DOCKER_EVENT", channel: "IN_APP", severity: "WARNING", title: a[3].title, status: "SENT", created_at: ago(22) },
    { id: uid("19", 4), category: "OPERATIONS", channel: "IN_APP", title: "Security updates applied on prod-web-02", body: "6 packages updated and verified.", status: "SENT", read_at: ago(100), created_at: ago(130) },
    { id: uid("19", 5), category: "SYSTEM_EVENT", channel: "IN_APP", title: "Kubernetes cluster staging-k3s connected", status: "SENT", read_at: ago(60 * 20), created_at: ago(60 * 24) },
  ];
}

// ---------------------------------------------------------------- operations

export const UPDATE_PLANS: UpdatePlan[] = [
  { id: uid("1a", 1), vm_id: VMS[1].id, vm_name: VMS[1].name, created_by: "Priya Sharma", status: "COMPLETED", created_at: ago(180), updated_at: ago(130) },
  { id: uid("1a", 2), vm_id: VMS[0].id, vm_name: VMS[0].name, created_by: "Priya Sharma", status: "READY", created_at: ago(40), updated_at: ago(35) },
];

export const UPDATE_OPERATIONS: UpdateOperation[] = [
  { id: uid("1b", 1), vm_id: VMS[1].id, vm_name: VMS[1].name, update_plan_id: UPDATE_PLANS[0].id, status: "SUCCESS", command_preview: "sudo apt-get install --only-upgrade -y openssl openssh-server curl libc6 python3.10 linux-image-generic", created_by: "Priya Sharma", started_at: ago(140), completed_at: ago(131), exit_code: 0, summary: "6 packages updated, 6 verified", created_at: ago(141) },
  { id: uid("1b", 2), vm_id: VMS[5].id, vm_name: VMS[5].name, status: "FAILED", command_preview: "sudo apt-get install --only-upgrade -y nginx", created_by: "Priya Sharma", started_at: ago(60 * 26), completed_at: ago(60 * 26 - 3), exit_code: 100, summary: "dpkg lock held by another process", created_at: ago(60 * 26) },
];

export const REBOOT_OPERATIONS: RebootOperation[] = [
  { id: uid("1c", 1), vm_id: VMS[1].id, vm_name: VMS[1].name, reason: "KERNEL_UPDATE", status: "SUCCESS", created_by: "Priya Sharma", started_at: ago(129), reboot_sent_at: ago(128), disconnected_at: ago(127.5), reconnected_at: ago(126), completed_at: ago(125), created_at: ago(129) },
];

export function databaseOperations(): DatabaseOperation[] {
  return [
    { id: uid("1d", 1), database_id: DATABASES[0].id, database_type: "POSTGRESQL", database_name: DATABASES[0].name, database_resource_id: DATABASES[0].resource_id, operation_type: "ANALYZE", status: "SUCCESS", requested_by: "Priya Sharma", reason: "Refresh planner statistics after bulk import", command_preview: "ANALYZE VERBOSE public.orders;", confirmed_at: ago(300), started_at: ago(299), completed_at: ago(297), result_summary: "Statistics refreshed for 1 table", health_before: "HEALTHY", health_after: "HEALTHY", created_at: ago(301) },
    { id: uid("1d", 2), database_id: DATABASES[0].id, database_type: "POSTGRESQL", database_name: DATABASES[0].name, database_resource_id: DATABASES[0].resource_id, operation_type: "CANCEL_QUERY", status: "SUCCESS", requested_by: "Priya Sharma", reason: "Long-running report query", parameters: { target_id: "48213" }, command_preview: "SELECT pg_cancel_backend(48213);", confirmed_at: ago(60 * 20), started_at: ago(60 * 20), completed_at: ago(60 * 20 - 0.1), result_summary: "Query cancelled", created_at: ago(60 * 20) },
    { id: uid("1d", 3), database_id: DATABASES[1].id, database_type: "REDIS", database_name: DATABASES[1].name, database_resource_id: DATABASES[1].resource_id, operation_type: "REDIS_MAINTENANCE", status: "WAITING_CONFIRMATION", requested_by: "Priya Sharma", reason: "Reclaim fragmented memory", command_preview: "MEMORY PURGE", created_at: ago(12) },
  ];
}

export function unifiedOperations(): UnifiedOperation[] {
  return [
    ...UPDATE_OPERATIONS.map((o): UnifiedOperation => ({ id: o.id, family: "UPDATE", operation_type: "PACKAGE_UPDATE", resource_id: o.vm_id ?? "", resource_name: o.vm_name ?? "", resource_type: "VM", status: o.status, requested_by_name: "Priya Sharma", requested_by_email: TEAM[0].email, summary: o.summary, created_at: o.created_at, started_at: o.started_at, completed_at: o.completed_at })),
    ...REBOOT_OPERATIONS.map((o): UnifiedOperation => ({ id: o.id, family: "REBOOT", operation_type: o.reason, resource_id: o.vm_id ?? "", resource_name: o.vm_name ?? "", resource_type: "VM", status: o.status, requested_by_name: "Priya Sharma", requested_by_email: TEAM[0].email, summary: "Rebooted and verified", created_at: o.created_at, started_at: o.started_at, completed_at: o.completed_at })),
    ...databaseOperations().map((o): UnifiedOperation => ({ id: o.id, family: "DATABASE", operation_type: o.operation_type, resource_id: o.database_id, resource_name: o.database_name ?? "", resource_type: "DATABASE", status: o.status, requested_by_name: "Priya Sharma", requested_by_email: TEAM[0].email, summary: o.result_summary, created_at: o.created_at, started_at: o.started_at, completed_at: o.completed_at })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

// ---------------------------------------------------------------- recommendations

export function recommendations(): Recommendation[] {
  return [
    { id: uid("1e", 1), resource_id: VMS[0].id, resource_name: VMS[0].name, resource_type: "VM", type: "SECURITY_UPDATE", severity: "CRITICAL", title: "Critical security update for openssh-server", description: "Upgrade openssh-server to 1:8.9p1-3ubuntu0.10.", status: "NEW", detected_at: ago(240) },
    { id: uid("1e", 2), resource_id: VMS[2].id, resource_name: VMS[2].name, resource_type: "VM", type: "HIGH_CPU", severity: "HIGH", title: "Sustained high CPU usage", description: "Consider scaling out prod-api or profiling the checkout workers.", status: "NEW", detected_at: ago(38) },
    { id: uid("1e", 3), resource_id: DATABASES[2].id, resource_name: DATABASES[2].name ?? "", resource_type: "DATABASE", type: "CONNECTION_PRESSURE", severity: "MEDIUM", title: "Connection pool close to its limit", description: "Raise max_connections or add a pooler such as ProxySQL.", status: "ACKNOWLEDGED", detected_at: ago(70) },
    { id: uid("1e", 4), resource_id: VMS[7].id, resource_name: VMS[7].name, resource_type: "VM", type: "REBOOT_REQUIRED", severity: "MEDIUM", title: "Reboot required to load the new kernel", status: "NEW", detected_at: ago(60 * 8) },
    { id: uid("1e", 5), resource_id: DATABASES[0].id, resource_name: DATABASES[0].name ?? "", resource_type: "DATABASE", type: "VACUUM", severity: "LOW", title: "Table bloat on public.order_events", description: "Run VACUUM ANALYZE during a quiet window.", status: "NEW", detected_at: ago(60 * 12) },
  ];
}

// ---------------------------------------------------------------- dashboards & access

export function monitoringFolders(): MonitoringFolder[] {
  return [
    { id: uid("1f", 1), feature: "DOCKER_MONITORING", workspace_id: WS_PROD.id, name: "Storefront", created_at: ago(60 * 24 * 20) },
    { id: uid("1f", 2), feature: "K8S_MONITORING", workspace_id: WS_PROD.id, name: "Production cluster", created_at: ago(60 * 24 * 18) },
    { id: uid("1f", 3), feature: "DOCKER_LOGS", workspace_id: WS_PROD.id, name: "Checkout troubleshooting", created_at: ago(60 * 24 * 12) },
    { id: uid("1f", 4), feature: "K8S_LOGS", workspace_id: WS_PROD.id, name: "Payments", created_at: ago(60 * 24 * 9) },
  ];
}

// Docker dashboards store container ids, not names.
function containerFilters(names: string[]): MonitoringDashboard["resource_selection"] {
  const containers = vmContainers(VMS[0].id);
  return names.flatMap((n) => {
    const c = containers.find((x) => x.name === n);
    return c ? [{ type: "CONTAINER" as const, value: c.id }] : [];
  });
}

export function monitoringDashboards(): MonitoringDashboard[] {
  const folders = monitoringFolders();
  const base = { workspace_id: WS_PROD.id, workspace_name: WS_PROD.name, refresh_interval_seconds: 30, created_at: ago(60 * 24 * 10) };
  return [
    { ...base, id: uid("20", 1), monitoring_folder_id: folders[0].id, folder_name: folders[0].name, feature: "DOCKER_MONITORING", name: "Storefront containers", description: "Web, checkout and cache", vm_resource_id: VMS[0].id, bound_resource_name: VMS[0].name, bound_resource_type: "VM", bound_resource_status: "ONLINE", resource_selection: containerFilters(["storefront-web", "checkout-api", "redis-cache"]), widgets: [{ type: "CPU_CHART", position: 0 }, { type: "MEMORY_CHART", position: 1 }, { type: "NETWORK_CHART", position: 2 }, { type: "CONTAINER_COUNT", position: 3 }, { type: "RESTART_COUNT", position: 4 }] },
    { ...base, id: uid("20", 2), monitoring_folder_id: folders[1].id, folder_name: folders[1].name, feature: "K8S_MONITORING", name: "prod-eks overview", k8s_cluster_resource_id: K8S_CLUSTERS[0].resource_id, bound_resource_name: K8S_CLUSTERS[0].name, bound_resource_type: "K8S_CLUSTER", bound_resource_status: "CONNECTED", resource_selection: [{ type: "NAMESPACE", value: "storefront" }, { type: "NAMESPACE", value: "payments" }], widgets: [{ type: "CPU_CHART", position: 0 }, { type: "MEMORY_CHART", position: 1 }, { type: "POD_COUNT", position: 2 }, { type: "RESOURCE_STATUS", position: 3 }] },
    { ...base, id: uid("20", 3), monitoring_folder_id: folders[2].id, folder_name: folders[2].name, feature: "DOCKER_LOGS", name: "checkout-api logs", vm_resource_id: VMS[0].id, bound_resource_name: VMS[0].name, bound_resource_type: "VM", bound_resource_status: "ONLINE", resource_selection: containerFilters(["checkout-api"]), widgets: [] },
    { ...base, id: uid("20", 4), monitoring_folder_id: folders[3].id, folder_name: folders[3].name, feature: "K8S_LOGS", name: "payments-gateway logs", k8s_cluster_resource_id: K8S_CLUSTERS[0].resource_id, bound_resource_name: K8S_CLUSTERS[0].name, bound_resource_type: "K8S_CLUSTER", bound_resource_status: "CONNECTED", resource_selection: [{ type: "NAMESPACE", value: "payments" }], widgets: [] },
  ];
}

export function dockerAccessGrants(): DockerAccessGrant[] {
  return [
    { id: uid("21", 1), user_id: TEAM[1].id, user_name: TEAM[1].name, user_email: TEAM[1].email, scope_type: "WORKSPACE", workspace_id: WS_PROD.id, workspace_name: WS_PROD.name, permission: "docker.monitor", created_at: ago(60 * 24 * 30) },
    { id: uid("21", 2), user_id: TEAM[1].id, user_name: TEAM[1].name, user_email: TEAM[1].email, scope_type: "WORKSPACE", workspace_id: WS_PROD.id, workspace_name: WS_PROD.name, permission: "docker.logs", created_at: ago(60 * 24 * 30) },
    { id: uid("21", 3), user_id: TEAM[2].id, user_name: TEAM[2].name, user_email: TEAM[2].email, scope_type: "RESOURCE", resource_id: K8S_CLUSTERS[1].resource_id, resource_name: K8S_CLUSTERS[1].name, permission: "k8s.monitor", created_at: ago(60 * 24 * 12) },
    { id: uid("21", 4), user_id: TEAM[2].id, user_name: TEAM[2].name, user_email: TEAM[2].email, scope_type: "DASHBOARD", dashboard_id: uid("20", 4), dashboard_name: "payments-gateway logs", permission: "k8s.logs", created_at: ago(60 * 24 * 6) },
  ];
}

// ---------------------------------------------------------------- audit

export function auditLogs(): AuditLogEntry[] {
  const p = TEAM[0];
  const rows: [string, AuditLogEntry["category"], string | undefined, number][] = [
    ["auth.login", "AUTHENTICATION", undefined, 35],
    ["alert.acknowledge", "ALERTS", "ALERT", 15],
    ["update_plan.approve", "UPDATES", "UPDATE_PLAN", 35],
    ["update_operation.execute", "OPERATIONS", "UPDATE_OPERATION", 141],
    ["vm.reboot", "OPERATIONS", "VM", 129],
    ["database_operation.confirm", "DATABASES", "DATABASE", 300],
    ["docker_access.grant", "PERMISSIONS", "WORKSPACE", 60 * 24 * 12],
    ["user.invite", "USERS", "USER", 60 * 24 * 2],
    ["k8s_cluster.create", "OTHER", "K8S_CLUSTER", 60 * 24 * 3],
    ["notification_policy.update", "SETTINGS", "NOTIFICATION_POLICY", 60 * 24 * 4],
    ["auth.login_failed", "AUTHENTICATION", undefined, 60 * 24 * 5],
  ];
  return rows.map(([action, category, resource_type, minutes], i) => ({
    id: uid("22", i + 1),
    actor_id: p.id,
    actor_name: p.name,
    actor_email: p.email,
    action,
    category,
    resource_type,
    ip_address: `203.0.113.${20 + i}`,
    user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0",
    metadata: action === "auth.login_failed" ? { reason: "invalid_password" } : {},
    created_at: ago(minutes),
  }));
}

export { GiB, MiB, uid };
