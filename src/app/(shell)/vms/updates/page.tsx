"use client";

import Link from "next/link";
import { VMPickerTable } from "@/components/infrastructure/vm-picker-table";

export default function VMUpdatesIndexPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Patch Management</h2>
        <p className="text-sm text-slate-500">Select a VM to view OS updates, package updates, and packages installed since onboarding.</p>
        <div className="mt-2 flex flex-wrap gap-4 text-sm">
          <Link href="/update-operations" className="text-sky-700 hover:underline">
            Update history →
          </Link>
          <Link href="/reboot-operations" className="text-sky-700 hover:underline">
            Reboot history →
          </Link>
        </div>
      </div>
      <VMPickerTable linkPrefix="/vms/updates" sshOnly emptyHint="No SSH-managed VMs yet -- register one in Compute Inventory. Agent-only VMs from Host Metrics & Logs are not listed here." />
    </div>
  );
}
