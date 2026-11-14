// The demo clock. The synthetic bank data ends on 2026-09-30, and all the demo's numbers, bills and reminders are built around
// that day as "today". This module makes the app show the REAL date instead: 30 September is displayed as today, and every other
// demo date moves by the same number of days (so "due in 5 days" stays "due in 5 days"). It does that in one place, by
// shifting dates as they are formatted for display (Intl.DateTimeFormat), so every screen follows the real date
// without changing its own code, including screens added later. Data, sums and logic are untouched.
//
// What is and isn't shifted:
//  - A date between 2024-01-01 and the data's end plus 40 days (the demo's fixtures reach about a month past it) is a "demo
//    date" and gets shifted when it is formatted.
//  - Real dates (today, timestamps, anything after that window) are left alone. Code that shows REAL calendar dates, like the
//    calendar page, must use plainFormat() below so it is never shifted.
//  - Nordea mode (real bank data, local only) turns the shift off: configureDemoClock(null).
//
// Pages call connection() before rendering (see the root layout), so the date is read per request, never frozen at deploy time.

const DAY = 86_400_000;
export const DATASET_END = "2026-09-30";
const WINDOW_START = Date.UTC(2024, 0, 1);
const WINDOW_AFTER_END_DAYS = 40;

type Originals = {
  getFormat: () => (d?: Date | number) => string;
  formatToParts: (d?: Date | number) => Intl.DateTimeFormatPart[];
};

// Keep the real Intl methods once per process, even if this file is reloaded in development.
const G = globalThis as unknown as { __solvoIntl?: Originals; __solvoClockEnd?: string | null };
const proto = Intl.DateTimeFormat.prototype as unknown as { format: unknown; formatToParts: Originals["formatToParts"] };
if (!G.__solvoIntl) {
  const getter = Object.getOwnPropertyDescriptor(proto, "format")?.get;
  if (getter) G.__solvoIntl = { getFormat: getter as unknown as Originals["getFormat"], formatToParts: proto.formatToParts };
}
const orig = G.__solvoIntl;

let datasetEnd: string | null = G.__solvoClockEnd === undefined ? DATASET_END : G.__solvoClockEnd;

const helsinki = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Helsinki" });
const realFormat = (f: Intl.DateTimeFormat, d: Date | number) => (orig ? orig.getFormat.call(f)(d) : f.format(d));

/** The real current date in Finland, as YYYY-MM-DD. Only call it while rendering a request or in the browser. */
export function todayIso(): string {
  return realFormat(helsinki, Date.now());
}

export const parseIso = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
export const daysBetween = (a: string, b: string) => Math.round((parseIso(b) - parseIso(a)) / DAY);
export const shiftIso = (iso: string, days: number) => new Date(parseIso(iso) + days * DAY).toISOString().slice(0, 10);

let memo: { at: number; value: number } | null = null;
/** How many days the demo timeline is moved forward right now: today minus the data's last day. 0 when the shift is off. */
export function offsetDays(): number {
  if (!datasetEnd) return 0;
  const now = Date.now();
  if (memo && now - memo.at < 30_000) return memo.value;
  const value = Math.max(0, daysBetween(datasetEnd, todayIso()));
  memo = { at: now, value };
  return value;
}

export const toShown = (demoIso: string) => shiftIso(demoIso, offsetDays());
export const toDemo = (realIso: string) => shiftIso(realIso, -offsetDays());

function shift(d?: Date | number): Date | number | undefined {
  if (d === undefined || !datasetEnd) return d;
  const ms = d instanceof Date ? d.getTime() : d;
  if (!Number.isFinite(ms) || ms < WINDOW_START || ms > parseIso(datasetEnd) + WINDOW_AFTER_END_DAYS * DAY) return d;
  const days = offsetDays();
  return days ? ms + days * DAY : d;
}

/** Turn the demo timeline on (the data's last day) or off (null, for real bank data). Safe to call on every request. */
export function configureDemoClock(end: string | null) {
  datasetEnd = end;
  G.__solvoClockEnd = end;
  memo = null;
  install();
}

function install() {
  if (!orig || (proto as { __solvoPatched?: boolean }).__solvoPatched) return;
  Object.defineProperty(proto, "format", {
    configurable: true,
    get(this: Intl.DateTimeFormat) {
      const f = orig.getFormat.call(this);
      return (d?: Date | number) => f(shift(d));
    },
  });
  proto.formatToParts = function (this: Intl.DateTimeFormat, d?: Date | number) {
    return orig.formatToParts.call(this, shift(d) as Date | number | undefined);
  };
  (proto as { __solvoPatched?: boolean }).__solvoPatched = true;
}
install();

/**
 * A date formatter that is never shifted. Use it for REAL calendar dates (the calendar page, "Coming up"), whose days can fall
 * inside the demo's window. Takes a YYYY-MM-DD string.
 */
export function plainFormat(options: Intl.DateTimeFormatOptions, locale = "en-GB") {
  const f = new Intl.DateTimeFormat(locale, { timeZone: "UTC", ...options });
  return (iso: string) => realFormat(f, parseIso(iso));
}
