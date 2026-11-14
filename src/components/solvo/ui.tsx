// Solvo's small visual system. Plain components with no hooks, so both server and client pages can use them.
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "cn";

export const eur = new Intl.NumberFormat("fi-FI", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
export const eur2 = new Intl.NumberFormat("fi-FI", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
/** A price with two decimals and a Finnish decimal comma (9,89), matching how eur/eur2 show money everywhere else. */
export const dec2 = (n: number) => n.toLocaleString("fi-FI", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Page padding that respects the notch and home bar. */
export const PAGE = "flex flex-1 flex-col px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-[calc(2rem+var(--tabbar-h))]";

export function Logo({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/solvo-logo.png" alt="Solvo" className={cn("h-6 w-auto", className)} />;
}

const backClass =
  "-ml-2 flex h-11 items-center gap-0.5 rounded-full pr-3 pl-1 text-[15px] font-medium text-primary active:bg-primary/10";

/** Top bar: back control on the left, the logo on the right. */
export function TopBar({ back }: { back?: ReactNode }) {
  return (
    <div className="flex h-11 items-center justify-between">
      {back ?? <span />}
      <Logo className="h-5" />
    </div>
  );
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className={backClass} transitionTypes={["nav-back"]}>
      <ChevronLeft className="size-5" strokeWidth={2.25} aria-hidden />
      {label}
    </Link>
  );
}

export function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className={backClass}>
      <ChevronLeft className="size-5" strokeWidth={2.25} aria-hidden />
      {label}
    </button>
  );
}

export function PageTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mt-3 mb-5">
      <h1 className="font-display text-[32px] leading-[1.05] font-semibold tracking-[-0.02em]">{title}</h1>
      {children && <p className="mt-2 text-[15px] leading-snug text-muted-foreground">{children}</p>}
    </div>
  );
}

/** The dark green slab. Used once per screen, for the number that matters. */
export function Slab({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section
      className={cn(
        "relative isolate overflow-hidden rounded-[28px] bg-slab p-5 text-white shadow-[0_18px_40px_-18px_rgba(12,53,36,0.55)]",
        className,
      )}
    >
      {/* Soft light in the corner gives the slab depth without a loud gradient. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-20 -z-10 size-64 rounded-full bg-[radial-gradient(closest-side,rgba(143,227,176,0.22),transparent)]"
      />
      {children}
    </section>
  );
}

/** An inset group of rows, like iOS settings. */
export function Group({
  title,
  aside,
  footer,
  className,
  children,
}: {
  title?: ReactNode;
  aside?: ReactNode;
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("mt-7", className)}>
      {(title || aside) && (
        <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
          {title && <h2 className="font-display text-[17px] font-semibold tracking-[-0.01em]">{title}</h2>}
          {aside && <div className="text-[13px] text-muted-foreground">{aside}</div>}
        </div>
      )}
      <div className="overflow-hidden rounded-2xl bg-card shadow-[0_1px_0_rgba(15,42,31,0.04),0_1px_3px_rgba(15,42,31,0.06)]">
        {children}
      </div>
      {footer && <p className="mt-2 px-1 text-[13px] leading-snug text-muted-foreground">{footer}</p>}
    </section>
  );
}

/** A row inside a Group. Rows after the first get a hairline that starts after the icon. */
export function Row({
  icon,
  title,
  subtitle,
  value,
  valueSub,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  value?: ReactNode;
  valueSub?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-14 items-center gap-3 px-4 py-3 [&+&]:border-t", className)}>
      {icon}
      <div className="min-w-0 flex-1">
        <div className="text-[15px] leading-snug font-medium">{title}</div>
        {subtitle && <div className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{subtitle}</div>}
      </div>
      {(value || valueSub) && (
        <div className="shrink-0 text-right">
          <div className="num text-[15px] font-medium">{value}</div>
          {valueSub && <div className="num mt-0.5 text-[12px] text-muted-foreground">{valueSub}</div>}
        </div>
      )}
    </div>
  );
}

export function IconTile({ children, tone = "green" }: { children: ReactNode; tone?: "green" | "warn" | "grey" }) {
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-xl [&_svg]:size-[18px]",
        tone === "green" && "bg-accent text-primary",
        tone === "warn" && "bg-warn-soft text-warn",
        tone === "grey" && "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

export function Chip({ children, tone = "grey" }: { children: ReactNode; tone?: "green" | "warn" | "grey" }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full px-2 text-[12px] font-medium whitespace-nowrap",
        tone === "green" && "bg-accent text-accent-foreground",
        tone === "warn" && "bg-warn-soft text-warn",
        tone === "grey" && "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

/** Primary action. Full width, 52px, the one green thing to tap. */
export const primaryButton =
  "flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-[16px] font-semibold text-primary-foreground shadow-[0_8px_20px_-10px_rgba(19,98,63,0.7)] transition-transform active:scale-[0.98] disabled:opacity-50";

export const secondaryButton =
  "flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-secondary px-5 text-[16px] font-semibold text-secondary-foreground transition-transform active:scale-[0.98]";
