// One way to show money moving, used on every screen that needs it (calendar, bills, plan):
// money out is a warm "−" in a circle, money in is a green "+" in a circle. The shape and the sign carry the
// meaning, not only the colour, so it still reads for people who can't tell red and green apart.
import { Minus, Plus } from "lucide-react";
import { cn } from "cn";
import { eur } from "@/components/solvo/ui";

export function MoneyBadge({ kind, size = "md", className }: { kind: "in" | "out"; size?: "sm" | "md"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full",
        size === "sm" ? "size-[18px]" : "size-7",
        kind === "in" ? "bg-accent text-primary" : "bg-warn-soft text-warn",
        className,
      )}
    >
      {kind === "in" ? (
        <Plus className={size === "sm" ? "size-3" : "size-4"} strokeWidth={3} aria-hidden />
      ) : (
        <Minus className={size === "sm" ? "size-3" : "size-4"} strokeWidth={3} aria-hidden />
      )}
      <span className="sr-only">{kind === "in" ? "Money in" : "Money out"}</span>
    </span>
  );
}

/** An amount with its sign written out: +€4 076 or −€909. */
export function SignedAmount({ kind, value, className }: { kind: "in" | "out"; value: number; className?: string }) {
  return (
    <span className={cn("num font-medium", kind === "in" ? "text-primary" : "text-warn", className)}>
      {kind === "in" ? "+" : "−"}
      {eur.format(value)}
    </span>
  );
}
