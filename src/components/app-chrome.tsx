"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { FloatingDock } from "@/components/floating-dock";
import { SpotifyController } from "@/components/spotify-controller";
import { applyStoredBackground } from "@/lib/background-options";

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  useEffect(() => {
    applyStoredBackground(localStorage.getItem("horizon-background"));
  }, []);
  return <>{children}{pathname === "/login" || pathname === "/spotify/callback" ? null : <><SpotifyController /><FloatingDock /></>}</>;
}
