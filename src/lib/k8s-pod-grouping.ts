import type { K8sOverviewPod } from "@/lib/api";

// Kubernetes adds a random suffix to every replica's pod name:
// "<app>-<replicaset hash>-<5 chars>" for a Deployment, "<app>-<5 chars>"
// for a DaemonSet or Job -- drawn from an alphabet with no vowels, so a
// name like "etcd-desktop-control-plane" is never mistaken for one -- or
// "<app>-<ordinal>" for a StatefulSet. Stripping it recovers the app, so
// a picker shows one row per app ("coredns ×2") instead of one per
// near-identical pod. Dashboards can store a whole namespace or single
// apps ("<namespace>/<app>"), so a fresh replica always shows up too.
// Keep in step with K8sPodAppKey in the API
// (internal/services/log_dashboard_alerts.go) -- alerts use the same
// grouping to decide which pods a dashboard covers.
const K8S_SUFFIX = "[bcdfghjklmnpqrstvwxz2456789]";
const DEPLOYMENT_POD = new RegExp(`^(.+)-${K8S_SUFFIX}{6,10}-${K8S_SUFFIX}{5}$`);
const GENERATED_POD = new RegExp(`^(.+)-${K8S_SUFFIX}{5}$`);
const ORDINAL_POD = /^(.+)-\d+$/;

export function podNameAppKey(name: string): string {
  const deployment = name.match(DEPLOYMENT_POD);
  if (deployment) return deployment[1];
  const generated = name.match(GENERATED_POD);
  if (generated) {
    // A CronJob's pods are "<cronjob>-<schedule time>-<5 chars>".
    const ordinal = generated[1].match(ORDINAL_POD);
    return ordinal ? ordinal[1] : generated[1];
  }
  const ordinal = name.match(ORDINAL_POD);
  if (ordinal) return ordinal[1];
  return name;
}

export function podAppKey(pod: K8sOverviewPod): string {
  const name = pod.pod_name ?? pod.display_name ?? "";
  return name ? podNameAppKey(name) : pod.pod_id;
}

// The value a dashboard's APP filter stores for this pod.
export function podAppFilterValue(pod: K8sOverviewPod): string | null {
  return pod.namespace ? `${pod.namespace}/${podAppKey(pod)}` : null;
}

// Whether a dashboard's selection (whole namespaces and/or single apps;
// neither = everything) includes this pod.
export function podInDashboardScope(pod: K8sOverviewPod, namespaces: Set<string>, apps: Set<string>): boolean {
  if (namespaces.size === 0 && apps.size === 0) return true;
  if (pod.namespace && namespaces.has(pod.namespace)) return true;
  const app = podAppFilterValue(pod);
  return app !== null && apps.has(app);
}

export type K8sAppGroup = { key: string; label: string; pods: K8sOverviewPod[]; nodes: string[] };

export function groupPodsByApp(pods: K8sOverviewPod[]): K8sAppGroup[] {
  const byKey = new Map<string, K8sOverviewPod[]>();
  for (const p of pods) {
    const key = podAppKey(p);
    const list = byKey.get(key) ?? [];
    list.push(p);
    byKey.set(key, list);
  }
  return [...byKey.entries()]
    .map(([key, groupPods]) => ({
      key,
      label: key,
      pods: groupPods,
      nodes: [...new Set(groupPods.map((p) => p.node_name).filter((n): n is string => Boolean(n)))],
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
