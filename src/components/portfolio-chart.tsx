"use client";

import { useState } from "react";

const W = 320;
const H = 120;
const PAD_Y = 10;
const monthFmt = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
const eur = new Intl.NumberFormat("fi-FI", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const fmtMonth = (ym: string) => monthFmt.format(new Date(`${ym}-01T00:00:00Z`));

/** Fund value per month against what was put in. Sits on the dark Slab. Touch or hover to read a month. */
export function PortfolioChart({ months, values, invested }: { months: string[]; values: number[]; invested: number }) {
  const [active, setActive] = useState<number | null>(null);
  const lo = Math.min(invested, ...values) * 0.97;
  const hi = Math.max(invested, ...values) * 1.01;
  const x = (i: number) => (i / (values.length - 1)) * W;
  const y = (v: number) => PAD_Y + (1 - (v - lo) / (hi - lo)) * (H - 2 * PAD_Y);
  const line = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const area = `${line}L${W},${H}L0,${H}Z`;
  const shown = active ?? values.length - 1;

  const pick = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left) / r.width) * (values.length - 1));
    setActive(Math.max(0, Math.min(values.length - 1, i)));
  };

  return (
    <figure className="mt-5">
      <div className="flex items-baseline justify-between text-[13px]">
        <span className="text-white/60">{fmtMonth(months[shown])}</span>
        <span className="num font-semibold text-white">{eur.format(values[shown])}</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-2 h-[120px] w-full touch-none overflow-visible"
        role="img"
        aria-label={`Fund value from ${fmtMonth(months[0])} to ${fmtMonth(months[months.length - 1])}: ${eur.format(values[0])} to ${eur.format(values[values.length - 1])}. Put in: ${eur.format(invested)}.`}
        onPointerDown={pick}
        onPointerMove={(e) => (e.pointerType === "mouse" || e.buttons) && pick(e)}
        onPointerLeave={() => setActive(null)}
        onPointerUp={(e) => e.pointerType !== "mouse" && setActive(null)}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="pf-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--mint)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--mint)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#pf-fill)" />
        <line
          x1="0"
          x2={W}
          y1={y(invested)}
          y2={y(invested)}
          stroke="white"
          strokeOpacity="0.4"
          strokeWidth="1.5"
          strokeDasharray="4 4"
          vectorEffect="non-scaling-stroke"
        />
        <path d={line} fill="none" stroke="var(--mint)" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {active !== null && (
          <line x1={x(active)} x2={x(active)} y1="0" y2={H} stroke="white" strokeOpacity="0.35" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        )}
      </svg>
      {/* The dot stays round although the svg stretches, so it is HTML on top. */}
      <div className="relative -mt-[120px] h-[120px] pointer-events-none" aria-hidden>
        <span
          className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-mint ring-2 ring-slab"
          style={{ left: `${(x(shown) / W) * 100}%`, top: `${(y(values[shown]) / H) * 100}%` }}
        />
      </div>
      <figcaption className="mt-2 flex items-center justify-between text-[12px] text-white/60">
        <span>{fmtMonth(months[0])}</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded bg-mint" aria-hidden /> Value
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 border-t-[1.5px] border-dashed border-white/50" aria-hidden /> Put in
          </span>
        </span>
        <span>{fmtMonth(months[months.length - 1])}</span>
      </figcaption>
    </figure>
  );
}
