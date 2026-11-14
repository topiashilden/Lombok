// Money skills: short learning packs in the coach chat. Each pack is three cards, one quiz question and a
// "try it with your own numbers" step. The numbers come from the person's own data (LearnContext, built on the
// server in learn-context.ts), so the lesson is about their electricity contract, their funds, their bills.
// Pure and client-safe: no data loading here, only the texts and the maths.
// Solvo explains how things work. It never tells the person which product to pick.

export type PackId = "electricity" | "fees" | "buffer";

export type LearnContext = {
  mode: "aino" | "new";
  electricity: {
    kwh: number; // yearly use
    hasInvoice: boolean; // Solvo has read this person's electricity e-invoice
    current: {
      supplier: string;
      cents: number;
      fee: number;
      afterCents: number;
      afterFee: number;
      endDate: string; // YYYY-MM-DD
    } | null;
    fixed: { cents: number; fee: number; termMonths: number | null }; // cheapest fixed price Solvo found
    spot: { margin: number; fee: number }; // cheapest spot margin Solvo found
    spotAvg: number; // expected yearly average spot price, c/kWh incl. VAT
  };
  funds: {
    hasFunds: boolean;
    value: number; // what the person has in funds today
    monthly: number; // a starting monthly amount for the try-it step
    holdings: { name: string; feePct: number }[];
  };
  buffer: {
    rentAndBills: number; // basket 1, per month
    groceries: number; // per month
    balance: number; // on the account today
    savingsGoal: number; // per month, what Solvo keeps out of the weekly budget
  };
};

export type Card = { title: string; body: string; you?: string };
export type Quiz = { question: string; options: string[]; correct: number; explain: string };
export type Pack = {
  id: PackId;
  title: string;
  short: string; // for chips and rows
  minutes: number;
  intro: string;
  cards: Card[];
  quiz: Quiz;
  tryTitle: string;
  followUps: string[]; // questions the person can send to the coach after the pack
};

export const PACK_IDS: PackId[] = ["electricity", "fees", "buffer"];

/** Titles for lists (Profile, the chat's start screen), without the person's numbers. */
export const PACK_META: { id: PackId; title: string; minutes: number }[] = [
  { id: "electricity", title: "Fixed or spot electricity?", minutes: 2 },
  { id: "fees", title: "How fund fees add up", minutes: 3 },
  { id: "buffer", title: "Emergency fund: how much is enough?", minutes: 2 },
];
const meta = (id: PackId) => PACK_META.find((m) => m.id === id)!;

const nf = (n: number, d = 0) => n.toLocaleString("fi-FI", { minimumFractionDigits: d, maximumFractionDigits: d });
const euro = (n: number) => `${nf(Math.round(n))} €`;
const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
const fmtDate = (iso: string) => dateFmt.format(new Date(`${iso}T00:00:00Z`));

// ---------- Electricity ----------

export const elecYear = (kwh: number, cents: number, fee: number) => (kwh * cents) / 100 + fee * 12;

/** Spot average (before margin) at which spot and the fixed offer cost the same for this person. */
export function breakEvenSpot(e: LearnContext["electricity"], kwh: number) {
  const fixed = elecYear(kwh, e.fixed.cents, e.fixed.fee);
  return ((fixed - e.spot.fee * 12) * 100) / Math.max(kwh, 1) - e.spot.margin;
}

/** What doing nothing at contract end costs per year, versus the price today. */
export function rolloverExtra(e: LearnContext["electricity"]) {
  if (!e.current) return 0;
  return elecYear(e.kwh, e.current.afterCents, e.current.afterFee) - elecYear(e.kwh, e.current.cents, e.current.fee);
}

// ---------- Fund fees ----------

export const ILLUSTRATIVE_RETURN_PCT = 6; // before fees, per year. An illustration, not a forecast.

/** Value after `years` with a start amount and a monthly deposit, monthly compounding, fee taken from the return. */
export function grow(start: number, monthly: number, years: number, feePct: number, returnPct = ILLUSTRATIVE_RETURN_PCT) {
  const r = (returnPct - feePct) / 100 / 12;
  let v = start;
  for (let m = 0; m < years * 12; m++) v = v * (1 + r) + monthly;
  return v;
}

/** End value and what the fee cost in euros, against the same fund with no fee. */
export function feeCost(start: number, monthly: number, years: number, feePct: number) {
  const value = grow(start, monthly, years, feePct);
  return { value, fees: grow(start, monthly, years, 0) - value, deposited: start + monthly * years * 12 };
}

export function feeLevels(f: LearnContext["funds"]) {
  const own = (pct: number) => f.holdings.find((h) => Math.abs(h.feePct - pct) < 0.02)?.name;
  const a = own(0.49);
  const b = own(1.05);
  return [
    { pct: 0.49, label: a ? `like your ${a}` : "index fund level" },
    { pct: 1.05, label: b ? `like your ${b}` : "a managed balanced fund" },
    { pct: 1.8, label: "typical active equity fund" },
  ];
}

// ---------- Buffer ----------

export const essentials = (b: LearnContext["buffer"]) => b.rentAndBills + b.groceries;

// ---------- The packs ----------

export function getPack(id: PackId, ctx: LearnContext): Pack {
  if (id === "electricity") return electricityPack(ctx);
  if (id === "fees") return feesPack(ctx);
  return bufferPack(ctx);
}

function electricityPack(ctx: LearnContext): Pack {
  const e = ctx.electricity;
  const c = e.current;
  const extra = rolloverExtra(e);
  return {
    ...meta("electricity"),
    short: "Fixed or spot?",
    intro: "Here's a two-minute pack on electricity prices. At the end you can try it with your own use.",
    cards: [
      {
        title: "Two ways to pay",
        body: "A fixed price stays the same for the whole contract, usually 12 to 36 months. A spot price follows the Nordic electricity market and changes every hour, and the seller adds a small margin on top.",
        you: c
          ? `You have a fixed price today: ${nf(c.cents, 2)} c/kWh with ${c.supplier}.`
          : undefined,
      },
      {
        title: "Who carries the risk",
        body: "With spot, you carry the price risk: cheap on windy summer days, expensive in cold, still winter weeks. With fixed, the seller carries it and prices that into the deal. Neither is always cheaper. Fixed is easier to budget, spot rewards flexible use.",
      },
      {
        title: "The rollover trap",
        body: "When a fixed contract ends and you do nothing, it usually continues automatically on a price the seller sets. That price is often higher than new customers get.",
        you:
          c && extra > 0
            ? `Yours ends on ${fmtDate(c.endDate)} and then moves to ${nf(c.afterCents, 2)} c/kWh. At ${nf(e.kwh)} kWh a year, that's about ${euro(extra)} more a year for doing nothing.`
            : undefined,
      },
    ],
    quiz: {
      question: "Your fixed contract ends and you don't do anything. What usually happens?",
      options: [
        "The electricity stops until you sign a new contract",
        "It continues on a new price the seller sets, often a higher one",
        "The old price stays the same for good",
      ],
      correct: 1,
      explain:
        c && extra > 0
          ? `Right: it rolls over. For you that's ${nf(c.cents, 2)} → ${nf(c.afterCents, 2)} c/kWh, about ${euro(extra)} a year. Solvo reminds you a month before an end date.`
          : "It rolls over to a price the seller sets. Your electricity never just stops, but the price can quietly go up. Note your end date somewhere you'll see it.",
    },
    tryTitle: "Try it with your own use",
    followUps: ["What happens if I do nothing with my electricity contract?", "How much do I spend on bills a month?"],
  };
}

function feesPack(ctx: LearnContext): Pack {
  const f = ctx.funds;
  return {
    ...meta("fees"),
    short: "Fund fees",
    intro: "Here's a three-minute pack on fund fees. At the end you can try it with your own amounts.",
    cards: [
      {
        title: "The fee you never see",
        body: "A fund's ongoing fee is a percentage of your money, taken every year whether the fund goes up or down. It comes out of the fund's value, so there's never a bill to notice.",
        you: f.hasFunds
          ? `Your two funds charge ${f.holdings.map((h) => `${nf(h.feePct, 2)} %`).join(" and ")} a year.`
          : undefined,
      },
      {
        title: "Small numbers, big totals",
        body: "The fee is taken from a balance that keeps growing, so it compounds just like returns do, only in the other direction. Half a percent sounds like nothing, but over 20 years it adds up to thousands.",
      },
      {
        title: "Index and active funds",
        body: "An index fund simply follows a list of companies, so it's usually cheap. An actively managed fund pays people to pick, and charges more for it. A higher fee isn't wrong, but the fund has to earn it back before you gain anything. Risk class and what the fund owns matter too.",
      },
    ],
    quiz: {
      question:
        "Two funds both earn 6 % a year before fees. One charges 0,5 %, the other 1,5 %. You put in €10,000 for 20 years. Roughly how much more does the cheaper one leave you?",
      options: ["About €200", "About €2,000", "About €5,000"],
      correct: 2,
      explain:
        "About €5,000 (€29,200 against €24,100). One percentage point a year, compounded for 20 years, is half of what you put in.",
    },
    tryTitle: "Try it with your own amounts",
    followUps: ["How are my funds doing?", "Where could I save the most?"],
  };
}

function bufferPack(ctx: LearnContext): Pack {
  const b = ctx.buffer;
  const need = essentials(b);
  return {
    ...meta("buffer"),
    short: "Safety buffer",
    intro: "Here's a two-minute pack on safety buffers. At the end you can work out yours from your own bills.",
    cards: [
      {
        title: "What it's for",
        body: "A buffer is money for things you can't plan: a broken laptop, a dentist bill, a gap between jobs. It's what keeps a bad month from turning into a loan or a late bill.",
      },
      {
        title: "A common rule of thumb",
        body: "Many advisers suggest about three months of essential costs: rent, bills and food. One month is a good first goal. If your income is irregular, aim higher.",
        you: `Your essentials come to about ${euro(need)} a month, so three months is about ${euro(need * 3)}.`,
      },
      {
        title: "Where to keep it",
        body: "Keep it apart from your spending money, so it doesn't quietly become this week's budget, but where you can reach it in a day. Not in shares or funds: their value can be down exactly when you need the money.",
        you: "Your safe-to-spend already keeps bills and irregular costs out of the weekly number. The buffer is the layer under that.",
      },
    ],
    quiz: {
      question: "Where is a good place to keep an emergency fund?",
      options: ["In an equity fund, so it grows", "On a separate savings account you can reach in a day", "As cash at home"],
      correct: 1,
      explain:
        "A separate savings account: safe, apart from your spending money and quick to reach. A fund can be down just when you need it, and cash at home earns nothing and can be lost.",
    },
    tryTitle: "Work out your own buffer",
    followUps: ["Can I afford an €80 dinner this week?", "Where could I save the most?"],
  };
}

/** Opens a pack from typed text, like "teach me about fund fees" or "opeta sähkösopimuksista". */
export function packFromText(text: string): PackId | null {
  const t = text.toLowerCase();
  if (!/\b(teach|learn|explain|lesson|course)\b|opeta|opi|selitä|kurssi/.test(t)) return null;
  if (/electric|spot|fixed|kwh|sähk|pörssi|kiinte/.test(t)) return "electricity";
  if (/fee|fund|index|invest|kulu|palkkio|rahasto|sijoit/.test(t)) return "fees";
  if (/buffer|emergency|rainy|safety|puskuri|hätä|varmuus/.test(t)) return "buffer";
  return null;
}
