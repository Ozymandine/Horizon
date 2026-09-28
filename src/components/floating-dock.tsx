"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Bookmark, Compass, House, Star, Waypoints } from "lucide-react";
import clsx from "clsx";

const tabs = [
  { href: "/", label: "Upcoming", icon: House },
  { href: "/timeline", label: "Timeline", icon: Waypoints },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/my-list", label: "My List", icon: Bookmark },
  { href: "/reviews", label: "Reviews", icon: Star },
];

export function FloatingDock() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main navigation" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 px-3">
      <div className="glass flex items-center gap-1 rounded-full p-1.5 shadow-2xl shadow-black/40">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "relative flex items-center gap-2 rounded-full px-3 py-2.5 text-xs font-medium transition-colors sm:px-4 sm:text-sm",
                active ? "text-white" : "text-slate-400 hover:text-white",
              )}
            >
              {active && <motion.span layoutId="active-tab" className="absolute inset-0 rounded-full bg-white/10" />}
              <Icon aria-hidden size={16} className="relative" />
              <span className="relative hidden sm:inline">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
