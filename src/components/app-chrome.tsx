"use client";

import { usePathname } from "next/navigation";
import { FloatingDock } from "@/components/floating-dock";

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return <>{children}{pathname === "/login" ? null : <FloatingDock />}</>;
}
