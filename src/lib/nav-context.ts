"use client";

import { usePathname, useSearchParams } from "next/navigation";

// A VM's Updates/Packages pages are shared by Compute Inventory and Patch
// Management. Links from Patch Management add ?from=patch, so those pages
// send "Back" to Patch Management and the header/sidebar keep showing
// Patch Management instead of switching to Compute Inventory.
export const FROM_PATCH = "patch";

export function useFromPatch(): boolean {
  return useSearchParams().get("from") === FROM_PATCH;
}

// "?from=patch" to carry along on links that stay inside the flow, or "".
export function patchQuery(fromPatch: boolean): string {
  return fromPatch ? `?from=${FROM_PATCH}` : "";
}

// The path the sidebar and header treat as current.
export function useNavPathname(): string {
  const pathname = usePathname();
  const fromPatch = useFromPatch();
  return fromPatch && pathname.startsWith("/vms/") ? `/vms/updates${pathname.slice("/vms".length)}` : pathname;
}
