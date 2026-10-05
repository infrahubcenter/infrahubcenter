"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Power, RefreshCw, Zap } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { OSUpdateStatusBadge } from "@/components/infrastructure/update-status-badge";
import { OperationStatusBadge } from "@/components/infrastructure/operation-status-badge";
import { SeverityBadge } from "@/components/infrastructure/severity-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatAgo } from "@/lib/format";
import {
  ApiError,
  createUpdatePlan,
  getPackageDiscoveryStatus,
  getVM,
  getVMUpdates,
  listRebootOperationsForVM,
  listUpdateOperationsForVM,
  refreshVMUpdates,
  requestReboot,
  type KernelInfo,
  type OSUpdateInfo,
  type PackageDiscoveryRun,
  type PackageUpdate,
  type RebootOperation,
  type UpdateOperation,
  type VMDetail,
  isAdminRole,
} from "@/lib/api";

export default function VMUpdatesPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const vmId = params.id;
  const { user } = useAuth();

  const [vm, setVm] = useState<VMDetail | null>(null);
  const [os, setOs] = useState<OSUpdateInfo | null>(null);
  const [kernel, setKernel] = useState<KernelInfo | null>(null);
  const [packages, setPackages] = useState<PackageUpdate[] | null>(null);
  // Latest package scan (null = never scanned) -- tells "no updates" apart
  // from "not checked" and "checked against old package lists".
  const [lastRun, setLastRun] = useState<PackageDiscoveryRun | null | undefined>(undefined);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [operations, setOperations] = useState<UpdateOperation[] | null>(null);
  const [rebootOperations, setRebootOperations] = useState<RebootOperation[] | null>(null);
  const [rebootConfirmed, setRebootConfirmed] = useState(false);
  const [rebooting, setRebooting] = useState(false);
  const [rebootError, setRebootError] = useState<string | null>(null);

  const loadUpdates = useCallback(() => {
    getVMUpdates(vmId)
      .then((res) => {
        setOs(res.os);
        setKernel(res.kernel);
        setPackages(res.packages);
      })
      .catch(() => setError("Failed to load updates."));
    getPackageDiscoveryStatus(vmId)
      .then((res) => setLastRun(res.runs[0] ?? null))
      .catch(() => setLastRun(null));
  }, [vmId]);

  useEffect(() => {
    getVM(vmId)
      .then(setVm)
      .catch((err) => setError(err instanceof ApiError && err.status === 404 ? "VM not found." : "Failed to load VM."));
  }, [vmId]);

  useEffect(() => {
    // Load-on-mount/param-change: no external store to subscribe to.

    loadUpdates();
  }, [loadUpdates]);

  useEffect(() => {
    listUpdateOperationsForVM(vmId)
      .then((res) => setOperations(res.operations))
      .catch(() => {});
  }, [vmId]);

  const loadRebootOperations = useCallback(() => {
    listRebootOperationsForVM(vmId)
      .then((res) => setRebootOperations(res.reboot_operations))
      .catch(() => {});
  }, [vmId]);

  useEffect(() => {
    loadRebootOperations();
  }, [loadRebootOperations]);

  function toggleSelected(packageId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(packageId)) {
        next.delete(packageId);
      } else {
        next.add(packageId);
      }
      return next;
    });
  }

  async function handleRefresh() {
    setRefreshing(true);
    setRefreshMessage(null);
    try {
      const result = await refreshVMUpdates(vmId);
      setRefreshMessage(
        result.status === "SUCCESS"
          ? `Refreshed: ${result.update_count} package update(s), OS status ${result.os_status ?? "unknown"}.`
          : (result.error_summary ?? `Refresh ${result.status.toLowerCase()}.`)
      );
      loadUpdates();
    } catch (err) {
      setRefreshMessage(err instanceof ApiError ? err.message : "Failed to refresh updates.");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleReboot() {
    setRebooting(true);
    setRebootError(null);
    try {
      const result = await requestReboot(vmId, kernel?.available ? "KERNEL_UPDATE" : "PACKAGE_UPDATE");
      router.push(`/reboot-operations/${result.operation_id}`);
    } catch (err) {
      setRebootError(err instanceof ApiError ? err.message : "Failed to start reboot.");
      setRebooting(false);
    }
  }

  async function handleCreatePlan() {
    if (selected.size === 0) return;
    setCreating(true);
    setError(null);
    try {
      const result = await createUpdatePlan(vmId, Array.from(selected).map((package_id) => ({ package_id })));
      router.push(`/vms/${vmId}/updates/plans/${result.plan.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create update plan.");
      setCreating(false);
    }
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!vm || !os || !kernel || !packages || lastRun === undefined) return <p className="text-sm text-slate-500">Loading&hellip;</p>;

  const securityCount = packages.filter((p) => p.is_security_update).length;
  // What has actually been checked -- never show a guess as a fact.
  // os.current is the version only ("24.04.5 LTS"); lead with the distro name.
  const osName = os.current
    ? vm.os_name && !os.current.includes(vm.os_name)
      ? `${vm.os_name} ${os.current}`
      : os.current
    : [vm.os_name, vm.os_version].filter(Boolean).join(" ") || "Unknown OS";
  const runningKernel = kernel.running ?? vm.kernel_version;
  const osChecked = Boolean(os.detected_at);
  const updatesChecked = lastRun !== null && lastRun.status !== "FAILED" && lastRun.status !== "RUNNING";
  const staleLists = lastRun?.status === "PARTIAL";
  const lastScanAt = lastRun?.completed_at ?? lastRun?.started_at ?? os.detected_at;
  const rebootKnown = kernel.reboot_status === "REQUIRED" || kernel.reboot_status === "NOT_REQUIRED";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href={`/vms/${vmId}`} className="flex w-fit items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-4 w-4" /> Back to {vm.name}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              {vm.name} {os.status !== "UNKNOWN" && <OSUpdateStatusBadge status={os.status} />}
            </h2>
            <p className="text-sm text-slate-500">
              {osName}
              {lastScanAt ? ` · Last scan: ${formatAgo(lastScanAt)}` : " · Never scanned"}
            </p>
          </div>
          <div className="flex gap-2">
            {isAdminRole(user?.role) && (
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh Updates
              </Button>
            )}
            {isAdminRole(user?.role) && !kernel.reboot_required && (
              <AlertDialog onOpenChange={(open) => !open && setRebootConfirmed(false)}>
                <AlertDialogTrigger render={<Button variant="outline" size="sm" />}>
                  <Power className="h-4 w-4" /> Reboot VM
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reboot {vm.name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This VM does not currently require a reboot. Current state: {vm.os_name ?? "Unknown OS"} {vm.os_version ?? ""}, kernel{" "}
                      {kernel.running ?? "unknown"}.
                      <br />
                      SSH, applications, Docker containers, and services may be temporarily unavailable.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="flex flex-col gap-2 text-sm">
                    {rebootError && <p className="text-red-600">{rebootError}</p>}
                    <label className="mt-2 flex items-start gap-2 text-sm text-slate-700">
                      <Checkbox checked={rebootConfirmed} onCheckedChange={(v) => setRebootConfirmed(v === true)} />
                      I understand the VM will temporarily become unavailable.
                    </label>
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      disabled={!rebootConfirmed || rebooting}
                      onClick={async () => {
                        setRebooting(true);
                        setRebootError(null);
                        try {
                          const result = await requestReboot(vmId, "ADMIN_REQUEST");
                          router.push(`/reboot-operations/${result.operation_id}`);
                        } catch (err) {
                          setRebootError(err instanceof ApiError ? err.message : "Failed to start reboot.");
                          setRebooting(false);
                        }
                      }}
                    >
                      {rebooting ? "Starting…" : "Reboot VM"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
        {refreshMessage && (
          <Alert>
            <AlertDescription>{refreshMessage}</AlertDescription>
          </Alert>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <InfoCard
          label="OS"
          value={
            os.status === "UPDATE_AVAILABLE"
              ? "Upgrade Available"
              : os.status === "UP_TO_DATE"
                ? "Latest Release"
                : osChecked
                  ? "Release check unavailable"
                  : "Not checked yet"
          }
          sub={os.available && os.status === "UPDATE_AVAILABLE" ? `${osName} → ${os.available}` : osName}
        />
        <InfoCard
          label="Package Updates"
          value={updatesChecked ? String(packages.length) : "—"}
          sub={!lastRun ? "Not scanned yet" : lastRun.status === "FAILED" ? "Check failed" : staleLists ? "From cached package lists" : undefined}
        />
        <InfoCard
          label="Security"
          value={updatesChecked ? String(securityCount) : "—"}
          tone={updatesChecked && securityCount > 0 ? "text-red-600" : undefined}
        />
        <InfoCard
          label="Kernel"
          value={
            kernel.available && kernel.available !== runningKernel
              ? "Newer Installed"
              : osChecked
                ? "Current"
                : "Not checked yet"
          }
          sub={kernel.available && kernel.available !== runningKernel ? `${runningKernel ?? "?"} → ${kernel.available}` : runningKernel}
        />
        <InfoCard
          label="Reboot"
          value={kernel.reboot_required ? "Required" : rebootKnown ? "Not Required" : osChecked ? "Unknown" : "Not checked yet"}
          tone={kernel.reboot_required ? "text-red-600" : undefined}
        />
      </div>

      {os.update_type === "RELEASE" && (
        <Alert>
          <AlertDescription>
            New OS release available ({os.available}). This is a major distribution release upgrade, not a routine patch, and requires
            additional compatibility review before it should be applied.
          </AlertDescription>
        </Alert>
      )}

      {kernel.reboot_required && (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>System reboot required{kernel.reboot_reason ? ` — ${kernel.reboot_reason}` : "."}</span>
            {isAdminRole(user?.role) && (
              <AlertDialog onOpenChange={(open) => !open && setRebootConfirmed(false)}>
                <AlertDialogTrigger render={<Button size="sm" variant="destructive" />}>
                  <Power className="h-4 w-4" /> Reboot VM
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reboot {vm.name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Current state: {vm.os_name ?? "Unknown OS"} {vm.os_version ?? ""}, kernel {kernel.running ?? "unknown"}.
                      {kernel.reboot_reason ? ` Reason: ${kernel.reboot_reason}` : ""}
                      <br />
                      SSH, applications, Docker containers, and services may be temporarily unavailable.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="flex flex-col gap-2 text-sm">
                    {rebootError && <p className="text-red-600">{rebootError}</p>}
                    <label className="mt-2 flex items-start gap-2 text-sm text-slate-700">
                      <Checkbox checked={rebootConfirmed} onCheckedChange={(v) => setRebootConfirmed(v === true)} />
                      I understand the VM will temporarily become unavailable.
                    </label>
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" disabled={!rebootConfirmed || rebooting} onClick={handleReboot}>
                      {rebooting ? "Starting…" : "Reboot VM"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Package Updates</h3>
        {isAdminRole(user?.role) && selected.size > 0 && (
          <Button size="sm" onClick={handleCreatePlan} disabled={creating}>
            <Zap className="h-4 w-4" /> {creating ? "Creating…" : `Create Update Plan (${selected.size})`}
          </Button>
        )}
      </div>

      {lastRun && (lastRun.status === "PARTIAL" || lastRun.status === "FAILED") && lastRun.error_summary && (
        <Alert variant={lastRun.status === "FAILED" ? "destructive" : undefined}>
          <AlertDescription>
            {lastRun.status === "FAILED" && <span className="font-medium">The last update check failed. </span>}
            {lastRun.error_summary}
          </AlertDescription>
        </Alert>
      )}

      {packages.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-medium text-slate-700">
            {!lastRun
              ? "This VM hasn't been scanned yet."
              : lastRun.status === "FAILED"
                ? "Updates couldn't be checked. See the message above."
                : staleLists
                  ? "No updates found in the package lists already on the server."
                  : "No package updates available. All packages are up to date."}
          </p>
          {!lastRun && isAdminRole(user?.role) && (
            <p className="mt-1 text-xs text-slate-500">Click Refresh Updates to scan its packages, OS, kernel and reboot state.</p>
          )}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {isAdminRole(user?.role) && <TableHead className="w-8" />}
              <TableHead>Package</TableHead>
              <TableHead>Installed</TableHead>
              <TableHead>Available</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Security</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {packages.map((p) => (
              <TableRow key={p.id}>
                {isAdminRole(user?.role) && (
                  <TableCell>
                    <Checkbox checked={selected.has(p.package_id)} onCheckedChange={() => toggleSelected(p.package_id)} />
                  </TableCell>
                )}
                <TableCell className="font-medium text-slate-900">{p.package_name}</TableCell>
                <TableCell className="text-slate-600">{p.current_version}</TableCell>
                <TableCell className="text-slate-600">{p.available_version}</TableCell>
                <TableCell className="text-slate-600">Package</TableCell>
                <TableCell>
                  <SeverityBadge severity={p.severity} />
                </TableCell>
                <TableCell>{p.is_security_update ? <Badge variant="destructive">Yes</Badge> : <Badge variant="outline">No</Badge>}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{p.recommendation_status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {operations !== null && operations.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-slate-900">Update History</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Exit Code</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {operations.map((op) => (
                <TableRow key={op.id}>
                  <TableCell>
                    <OperationStatusBadge status={op.status} />
                  </TableCell>
                  <TableCell className="text-slate-600">{op.started_at ? new Date(op.started_at).toLocaleString() : "—"}</TableCell>
                  <TableCell className="text-slate-600">{op.exit_code ?? "—"}</TableCell>
                  <TableCell>
                    <Link href={`/update-operations/${op.id}`} className="text-sm text-slate-600 underline hover:text-slate-900">
                      View
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {rebootOperations !== null && rebootOperations.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-slate-900">Recent Reboots</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Started</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rebootOperations.map((op) => (
                <TableRow key={op.id}>
                  <TableCell className="text-slate-600">{op.reason.replace("_", " ")}</TableCell>
                  <TableCell>
                    <OperationStatusBadge status={op.status} />
                  </TableCell>
                  <TableCell className="text-slate-600">{op.started_at ? new Date(op.started_at).toLocaleString() : "—"}</TableCell>
                  <TableCell>
                    <Link href={`/reboot-operations/${op.id}`} className="text-sm text-slate-600 underline hover:text-slate-900">
                      View
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function InfoCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${tone ?? "text-slate-900"}`}>{value}</div>
      {sub && <div className="mt-1 truncate text-xs text-slate-500">{sub}</div>}
    </div>
  );
}
