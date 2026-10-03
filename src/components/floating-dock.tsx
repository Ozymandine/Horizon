"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bookmark, Compass, Settings, Waypoints } from "lucide-react";
import clsx from "clsx";

const tabs = [
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/timeline", label: "Timeline", icon: Waypoints },
  { href: "/my-list", label: "My List", icon: Bookmark },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function FloatingDock() {
  const pathname = usePathname();
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 640px)");
    let lastY = window.scrollY;
    const update = () => {
      const nextY = Math.max(0, window.scrollY);
      if (!mobile.matches || nextY < 60) setHidden(false);
      else if (Math.abs(nextY - lastY) > 5) setHidden(nextY > lastY);
      lastY = nextY;
    };
    window.addEventListener("scroll", update, { passive: true });
    mobile.addEventListener("change", update);
    update();
    return () => { window.removeEventListener("scroll", update); mobile.removeEventListener("change", update); };
  }, [pathname]);

  return (
    <nav aria-label="Main navigation" aria-hidden={hidden || undefined} inert={hidden} data-scroll-hidden={hidden} className="floating-dock fixed bottom-[calc(.75rem+env(safe-area-inset-bottom))] left-1/2 z-50 -translate-x-1/2 px-2 sm:bottom-[calc(1.25rem+env(safe-area-inset-bottom))] sm:px-3">
      <div className="glass flex items-center gap-1 rounded-full border-white/20 bg-slate-950/35 p-1.5 text-white shadow-2xl shadow-black/40 backdrop-blur-2xl">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "relative flex items-center gap-2 rounded-full px-3 py-2.5 text-xs font-medium text-white transition-colors md:px-4 md:text-sm",
                active ? "text-white" : "text-white/85 hover:bg-white/10 hover:text-white",
              )}
            >
              {active && <motion.span layoutId="active-tab" className="absolute inset-0 rounded-full border border-white/10 bg-white/15" />}
              <Icon aria-hidden size={16} className="relative" />
              <span className="relative hidden md:inline">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
