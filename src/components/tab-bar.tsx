"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House,
  MessageCircle,
  PiggyBank,
  ReceiptText,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Home", Icon: House },
  { href: "/bills", label: "Bills", Icon: ReceiptText },
  { href: "/coach", label: "Chat", Icon: MessageCircle, center: true },
  { href: "/save", label: "Save", Icon: PiggyBank },
  { href: "/profile", label: "Profile", Icon: UserRound },
] as const;

// Full-screen pages with no tab bar.
const HIDDEN = ["/call"];

/**
 * Bottom tab bar, like a native app. Its height is --tabbar-h (globals.css), which pages and fixed action bars use
 * for bottom padding. It hides while a text field has focus so the keyboard doesn't push it up.
 */
export function TabBar() {
  const path = usePathname();
  if (HIDDEN.some((p) => path.startsWith(p))) return null;

  return (
    <nav
      id="tabbar"
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-[25] mx-auto w-full max-w-[430px] border-t border-border/70 bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
    >
      <ul className="flex h-14">
        {TABS.map(({ href, label, Icon, ...t }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          const center = "center" in t;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                {center ? (
                  <span
                    className={cn(
                      "-mt-5 flex size-12 items-center justify-center rounded-full shadow-[0_8px_20px_-8px_rgba(19,98,63,0.6)] ring-4 ring-background",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "bg-slab text-mint",
                    )}
                  >
                    <Icon className="size-[22px]" aria-hidden />
                  </span>
                ) : (
                  <Icon
                    className="size-[22px]"
                    strokeWidth={active ? 2.25 : 1.75}
                    aria-hidden
                  />
                )}
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
