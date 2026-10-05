"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { OperationStatusBadge } from "@/components/infrastructure/operation-status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ApiError,
  listRebootOperationsForVM,
  listUpdateOperationsForVM,
  type RebootOperation,
  type UpdateOperation,
} from "@/lib/api";

function duration(startedAt?: string, completedAt?: string): string {
  if (!startedAt || !completedAt) return "—";
  const seconds = Math.max(0, Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function when(at?: string): string {
  return at ? new Date(at).toLocaleString() : "—";
}

// This VM's update runs -- always reachable from its Patch Management page,
// not only while an operation is running. Rows open the operation's own
// page, which sends Back here (?from=patch).
export function VMUpdateHistory({ vmId }: { vmId: string }) {
  const [ops, setOps] = useState<UpdateOperation[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listUpdateOperationsForVM(vmId)
      .then((res) => setOps(res.operations))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load update history."));
  }, [vmId]);

  return (
    <HistoryCard title="Update History" allHref="/update-operations" allLabel="All update operations" error={error} loading={!ops && !error}>
      {ops && ops.length === 0 && <Empty text="No updates have run on this VM yet." />}
      {ops && ops.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Started</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Run By</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Exit Code</TableHead>
              <TableHead>Summary</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {ops.map((op) => (
              <TableRow key={op.id}>
                <TableCell className="whitespace-nowrap text-slate-600">{when(op.started_at ?? op.created_at)}</TableCell>
                <TableCell>
                  <OperationStatusBadge status={op.status} />
                </TableCell>
                <TableCell className="text-slate-600">{op.created_by ?? "—"}</TableCell>
                <TableCell className="text-slate-600">{duration(op.started_at, op.completed_at)}</TableCell>
                <TableCell className="text-slate-600">{op.exit_code ?? "—"}</TableCell>
                <TableCell className="max-w-xs truncate text-slate-600" title={op.summary}>
                  {op.summary ?? "—"}
                </TableCell>
                <TableCell>
                  <Link href={`/update-operations/${op.id}?from=patch`} className="text-sm text-slate-600 underline hover:text-slate-900">
                    View
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </HistoryCard>
  );
}

// This VM's controlled reboots -- same idea as VMUpdateHistory.
export function VMRebootHistory({ vmId }: { vmId: string }) {
  const [ops, setOps] = useState<RebootOperation[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listRebootOperationsForVM(vmId)
      .then((res) => setOps(res.reboot_operations))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load reboot history."));
  }, [vmId]);

  return (
    <HistoryCard title="Reboot History" allHref="/reboot-operations" allLabel="All reboot operations" error={error} loading={!ops && !error}>
      {ops && ops.length === 0 && <Empty text="This VM hasn't been rebooted through Infra Hub Center yet." />}
      {ops && ops.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Started</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Requested By</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {ops.map((op) => (
              <TableRow key={op.id}>
                <TableCell className="whitespace-nowrap text-slate-600">{when(op.started_at ?? op.created_at)}</TableCell>
                <TableCell>
                  <OperationStatusBadge status={op.status} />
                </TableCell>
                <TableCell className="text-slate-600">{op.reason.replaceAll("_", " ")}</TableCell>
                <TableCell className="text-slate-600">{op.created_by ?? "—"}</TableCell>
                <TableCell className="text-slate-600">{duration(op.started_at, op.completed_at)}</TableCell>
                <TableCell>
                  <Link href={`/reboot-operations/${op.id}?from=patch`} className="text-sm text-slate-600 underline hover:text-slate-900">
                    View
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </HistoryCard>
  );
}

function HistoryCard({
  title,
  allHref,
  allLabel,
  error,
  loading,
  children,
}: {
  title: string;
  allHref: string;
  allLabel: string;
  error: string | null;
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <Link href={allHref} className="text-sm text-sky-700 hover:underline">
          {allLabel} →
        </Link>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-slate-500">Loading&hellip;</p>}
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center">
      <p className="text-sm text-slate-600">{text}</p>
    </div>
  );
}
