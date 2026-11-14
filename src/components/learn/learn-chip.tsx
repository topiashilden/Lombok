// "Learn why" chip: opens the matching learning pack in the coach chat. No hooks, so server pages can use it.
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PackId } from "@/lib/learn";

export function LearnChip({
  pack,
  children,
  className,
  tone = "light",
}: {
  pack: PackId;
  children: React.ReactNode;
  className?: string;
  tone?: "light" | "dark";
}) {
  return (
    <Link
      href={`/coach?learn=${pack}`}
      transitionTypes={["nav-forward"]}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-full px-3.5 text-[14px] font-medium",
        tone === "light" && "bg-accent text-accent-foreground active:bg-accent/70",
        tone === "dark" && "bg-white/12 text-white active:bg-white/20",
        className,
      )}
    >
      <GraduationCap className={cn("size-[18px] shrink-0", tone === "light" ? "text-primary" : "text-mint")} aria-hidden />
      {children}
    </Link>
  );
}
