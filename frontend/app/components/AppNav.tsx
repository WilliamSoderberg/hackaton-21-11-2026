"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dispatcher" },
  { href: "/crew/overview", label: "Crew overview" },
  { href: "/crew", label: "Ambulance crew" },
];

// "/crew/<incident>" belongs to "Ambulance crew"; the overview has its own tab.
function isCurrent(pathname: string, href: string) {
  if (href === "/" || href === "/crew/overview") return pathname === href;
  return pathname === href || (pathname.startsWith(`${href}/`) && pathname !== "/crew/overview");
}

export default function AppNav() {
  const pathname = usePathname();
  return (
    <nav className="flex rounded-lg bg-slate-100 p-1 text-sm font-medium" aria-label="Main">
      {links.map((link) => {
        const current = isCurrent(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={current ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 ${
              current ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
