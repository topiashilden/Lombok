"use client";

// "What matters most to you?": a row of choices that sets the coach's pick. Every offer stays selectable.
import type { ReactNode } from "react";

export function PreferencePicker<T extends string>(props: {
  title?: string;
  value: T;
  options: { value: T; label: string; icon?: ReactNode }[];
  onChange: (value: T) => void;
}) {
  const title = props.title ?? "What matters most to you?";
  return (
    <section className="mt-7">
      <h2 className="mb-2 px-1 font-display text-[17px] font-semibold tracking-[-0.01em]">{title}</h2>
      <div role="radiogroup" aria-label={title} className={`grid gap-2 ${props.options.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
        {props.options.map((o) => {
          const on = o.value === props.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => props.onChange(o.value)}
              className={`flex min-h-11 items-center justify-center gap-1.5 rounded-2xl px-2 py-2.5 text-center text-[14px] leading-tight font-medium transition-colors ${
                on ? "bg-primary text-primary-foreground" : "bg-card text-foreground shadow-[0_1px_3px_rgba(15,42,31,0.06)] active:bg-muted"
              }`}
            >
              {o.icon}
              {o.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
