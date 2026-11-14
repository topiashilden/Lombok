"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { primaryButton } from "@/components/solvo/ui";

/** A bottom sheet for small edits. Same look as the approval sheet; closes on the backdrop, Escape or Done. */
export function Sheet({
  title,
  onClose,
  onDone,
  doneLabel = "Done",
  doneDisabled = false,
  hideDone = false,
  children,
}: {
  title: string;
  onClose: () => void;
  onDone?: () => void; // what the main button does; defaults to closing
  doneLabel?: string;
  doneDisabled?: boolean;
  hideDone?: boolean; // for sheets whose choices act on their own
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-30 mx-auto flex w-full max-w-[430px] flex-col justify-end">
      <button type="button" aria-label="Close" className="absolute inset-0 animate-in bg-slab/40 backdrop-blur-[2px] fade-in motion-reduce:animate-none" onClick={onClose} />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        className="relative max-h-[85dvh] animate-in overflow-y-auto overscroll-contain rounded-t-[28px] bg-card px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl duration-300 slide-in-from-bottom motion-reduce:animate-none"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" aria-hidden />
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="sheet-title" className="font-display text-[22px] font-semibold tracking-[-0.015em]">
            {title}
          </h2>
          <button type="button" aria-label="Close" onClick={onClose} className="flex size-11 items-center justify-center rounded-full active:bg-muted">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        {children}
        {!hideDone && (
          <button type="button" className={`${primaryButton} mt-6`} onClick={onDone ?? onClose} disabled={doneDisabled}>
            {doneLabel}
          </button>
        )}
      </section>
    </div>
  );
}
