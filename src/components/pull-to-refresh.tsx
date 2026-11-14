"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const TRIGGER = 64; // px of (damped) pull that triggers a refresh
const MAX = 96;
const HIDDEN = ["/call"];

/**
 * Pull down at the top of a page to refresh, like a native app. The home-screen app on iPhone has no browser
 * pull-to-refresh, and body has overscroll-behavior: none, so this is the only one.
 */
export function PullToRefresh() {
  const router = useRouter();
  const path = usePathname();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const start = useRef<number | null>(null);
  const pullRef = useRef(0);
  const off = HIDDEN.some((p) => path.startsWith(p));

  useEffect(() => {
    if (off) return;
    const set = (v: number) => {
      pullRef.current = v;
      setPull(v);
    };
    const onStart = (e: TouchEvent) => {
      const target = e.target as Element | null;
      // Not inside a bottom sheet or the tab bar, and only from the very top of the page.
      if (
        window.scrollY > 0 ||
        target?.closest("[role=dialog], #tabbar, input, textarea")
      ) {
        start.current = null;
        return;
      }
      start.current = e.touches[0].clientY;
    };
    const onMove = (e: TouchEvent) => {
      if (start.current === null) return;
      const dy = e.touches[0].clientY - start.current;
      if (dy <= 0 || window.scrollY > 0) {
        if (pullRef.current) set(0);
        return;
      }
      setDragging(true);
      set(Math.min(MAX, dy * 0.5));
    };
    const onEnd = () => {
      if (start.current === null) return;
      start.current = null;
      setDragging(false);
      if (pullRef.current >= TRIGGER) {
        setRefreshing(true);
        set(TRIGGER);
        router.refresh();
        window.setTimeout(() => {
          setRefreshing(false);
          set(0);
        }, 800);
      } else {
        set(0);
      }
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [off, router]);

  if (off || (pull === 0 && !refreshing)) return null;
  const ready = pull >= TRIGGER;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-40 mx-auto flex w-full max-w-[430px] justify-center pt-[env(safe-area-inset-top)]"
      style={{
        transform: `translateY(${pull - 40}px)`,
        transition: dragging ? "none" : "transform 200ms ease-out",
      }}
    >
      <span
        className={cn(
          "flex size-10 items-center justify-center rounded-full bg-card shadow-[0_4px_14px_rgba(15,42,31,0.18)]",
          ready ? "text-primary" : "text-muted-foreground",
        )}
      >
        <RefreshCw
          className={cn("size-5", refreshing && "animate-spin")}
          style={
            refreshing
              ? undefined
              : { transform: `rotate(${(pull / TRIGGER) * 270}deg)` }
          }
          aria-hidden
        />
        <span className="sr-only">
          {refreshing
            ? "Refreshing"
            : ready
              ? "Release to refresh"
              : "Pull to refresh"}
        </span>
      </span>
    </div>
  );
}
