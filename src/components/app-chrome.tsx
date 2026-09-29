"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { FloatingDock } from "@/components/floating-dock";
import { applyBackground, backgroundOptions } from "@/lib/background-options";

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  useEffect(() => {
    applyBackground(localStorage.getItem("horizon-background") ?? backgroundOptions[0].id);
  }, []);
  return <>{children}{pathname === "/login" ? null : <FloatingDock />}</>;
}
