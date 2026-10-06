"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { MonitoringBreadcrumb } from "@/components/infrastructure/monitoring-breadcrumb";
import { K8sLogsBrowser } from "@/components/infrastructure/k8s-logs-browser";
import { DashboardHeaderActions } from "@/components/infrastructure/dashboard-header-actions";
import { LogDashboardAlertRuleForm } from "@/components/infrastructure/log-dashboard-alert-rule-form";
import { Bell } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { isAdminRole, getMonitoringDashboard, listK8sOverview, type K8sOverviewPod, type MonitoringDashboard } from "@/lib/api";
import { podInDashboardScope } from "@/lib/k8s-pod-grouping";

export default function LogsKubernetesDashboardPage() {
  const params = useParams<{ dashboardId: string }>();
  const dashboardId = params.dashboardId;
  const { user } = useAuth();
  const isAdmin = isAdminRole(user?.role);

  const [dashboard, setDashboard] = useState<MonitoringDashboard | null>(null);
  const [pods, setPods] = useState<K8sOverviewPod[]>([]);
  const [error, setError] = useState(false);
  const [showAlertForm, setShowAlertForm] = useState(false);
  const [alertSaved, setAlertSaved] = useState(false);

  useEffect(() => {
    getMonitoringDashboard(dashboardId)
      .then((d) => {
        setDashboard(d);
        return listK8sOverview(d.k8s_cluster_resource_id);
      })
      .then((r) => setPods(r.pods))
      .catch(() => setError(true));
  }, [dashboardId]);

  const selectedNamespaces = useMemo(
    () => new Set((dashboard?.resource_selection ?? []).filter((f) => f.type === "NAMESPACE").map((f) => f.value)),
    [dashboard]
  );
  const selectedApps = useMemo(
    () => new Set((dashboard?.resource_selection ?? []).filter((f) => f.type === "APP").map((f) => f.value)),
    [dashboard]
  );
  // Whole namespaces plus single apps; neither means the whole cluster.
  const scopedPods = useMemo(
    () => pods.filter((p) => podInDashboardScope(p, selectedNamespaces, selectedApps)),
    [pods, selectedNamespaces, selectedApps]
  );

  if (error) return <p className="text-sm text-red-600">Failed to load this dashboard.</p>;
  if (!dashboard) return <p className="text-sm text-slate-500">Loading&hellip;</p>;

  return (
    <div className="flex flex-col gap-4">
      <MonitoringBreadcrumb
        segments={[
          { label: "Logs", href: "/logs/kubernetes" },
          { label: "Kubernetes", href: "/logs/kubernetes" },
          ...(dashboard.folder_name ? [{ label: dashboard.folder_name, href: `/logs/kubernetes/folders/${dashboard.monitoring_folder_id}` }] : []),
          { label: dashboard.name },
        ]}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-slate-900">{dashboard.name}</h1>
          <Badge className="gap-1 bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200">Live</Badge>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setAlertSaved(false);
                setShowAlertForm((v) => !v);
              }}
              title="Alert on errors in this dashboard's logs"
            >
              <Bell className="h-4 w-4" /> Create alert
            </Button>
          <DashboardHeaderActions
            dashboard={dashboard}
            onUpdated={setDashboard}
            backHref={dashboard.monitoring_folder_id ? `/logs/kubernetes/folders/${dashboard.monitoring_folder_id}` : "/logs/kubernetes"}
          />
          </div>
        )}
      </div>
      {isAdmin && showAlertForm && (
        <LogDashboardAlertRuleForm
          dashboard={dashboard}
          onSaved={() => {
            setShowAlertForm(false);
            setAlertSaved(true);
          }}
          onCancel={() => setShowAlertForm(false)}
        />
      )}
      {alertSaved && (
        <p className="text-sm text-emerald-700">
          Alert saved. Manage it under{" "}
          <Link href="/alerts?tab=rules" className="underline">
            Alerts &rsaquo; Alert Rules
          </Link>
          .
        </p>
      )}
      <K8sLogsBrowser pods={scopedPods} isAdmin={isAdmin} />
    </div>
  );
}
