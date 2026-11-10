"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LinkPending } from "@/components/LinkPending";
import { useI18n } from "@/lib/i18n/provider";

type Item = {
  href: string;
  label: string;
  icon: string;
  badge?: number;
};

export function BottomNav({ items }: { items: Item[] }) {
  const pathname = usePathname();
  const { dir } = useI18n();
  // Six tabs (the manager) only fit a phone with tighter spacing.
  const compact = items.length > 5;

  return (
    <nav className="bottom-nav" dir={dir}>
      <div className="mx-auto grid max-w-[480px]" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex min-w-0 flex-col items-center gap-1 rounded-2xl py-2 font-bold transition ${
                compact ? "px-0.5 text-[11px]" : "px-2 text-xs"
              } ${active ? "bg-cream-deep text-accent" : "text-ink-soft"}`}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span>{item.label}</span>
              {item.badge && item.badge > 0 ? (
                <span className="absolute end-2 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] text-white">
                  {item.badge}
                </span>
              ) : null}
              <LinkPending />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
