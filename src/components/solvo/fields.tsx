"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";

/**
 * A money or number field that can be emptied and retyped. A controlled <input type="number"> kept a leading 0
 * the person could not delete, so this keeps the raw text and only reports the parsed number.
 */
export function NumberField({
  label,
  value,
  onChange,
  suffix,
  min = 0,
  max,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  suffix?: string;
  min?: number;
  max?: number;
}) {
  const [text, setText] = useState(value ? String(value) : "");
  return (
    <label className="flex flex-1 flex-col gap-1">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className="flex h-11 items-center rounded-xl bg-muted px-3 focus-within:ring-2 focus-within:ring-primary/40">
        <input
          type="text"
          inputMode="numeric"
          enterKeyHint="done"
          autoComplete="off"
          value={text}
          placeholder="0"
          onChange={(e) => {
            const digits = e.target.value.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
            setText(digits);
            const n = digits === "" ? 0 : Number(digits);
            onChange(Math.min(max ?? Infinity, Math.max(min, n)));
          }}
          className="num w-full min-w-0 bg-transparent outline-none"
        />
        {suffix && <span className="text-[13px] text-muted-foreground">{suffix}</span>}
      </span>
    </label>
  );
}

/** Plus and minus buttons for a small whole number, like a day of the month. 44px targets. */
export function Stepper({ label, value, onChange, min, max, format }: { label: string; value: number; onChange: (n: number) => void; min: number; max: number; format?: (n: number) => string }) {
  const btn = "flex size-11 items-center justify-center rounded-xl bg-muted active:scale-95 disabled:opacity-40";
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <div className="flex items-center gap-3">
        <button type="button" className={btn} onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`Earlier, ${label}`}>
          <Minus className="size-4" aria-hidden />
        </button>
        <span className="num min-w-24 text-center text-[17px] font-semibold">{format ? format(value) : value}</span>
        <button type="button" className={btn} onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`Later, ${label}`}>
          <Plus className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
