"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { segmentedGroup, segmentedItem } from "./PageHeader";

const links = [
  { href: "/", label: "Dispatcher" },
  { href: "/crew", label: "Ambulance crew" },
  { href: "/calls", label: "Ongoing calls" },
  { href: "/testbench", label: "Model testbench" },
];

function isCurrent(pathname: string, href: string) {
  if (href === "/") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppNav() {
  const pathname = usePathname();
  return (
    <nav className={segmentedGroup} aria-label="Main">
      {links.map((link) => {
        const current = isCurrent(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={current ? "page" : undefined}
            className={segmentedItem(current)}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
