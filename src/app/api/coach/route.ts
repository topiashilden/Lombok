import { SAVED_READINGS } from "@/data/einvoices/saved-readings";
import { portfolio } from "@/data/portfolio";
import { UNPAID } from "@/data/reminders";
import { fundById } from "@/lib/funds";
import { safeToSpend } from "@/lib/coach";
import { BASKET_LABELS, MAIN_CUSTOMER, type Basket } from "@/lib/demo";
import { compare } from "@/lib/offers";
import { MERCHANT_TYPE_NAMES, spending, type SpendingQuery, type SpendingResult } from "@/lib/spending";

// Coach chat. Gemini answers, but every spending number comes from the `spending` tool,
// which runs exact queries over the customer's real S-Pankki transactions.
// POST { messages: [{ role: "user" | "coach", text }] } -> { answer, checks, source, ms, error? }

export const maxDuration = 30;

// The free tier allows ~20 requests a day per model, so fall back to a lighter model on quota or overload errors.
const MODELS = [process.env.GEMINI_MODEL ?? "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3-flash-preview", "gemini-3.1-flash-lite"];
const DEADLINE_MS = 24_000;
const MAX_TOOL_ROUNDS = 4;

type ChatMessage = { role: "user" | "coach"; text: string };
type Part = { text?: string; functionCall?: { name: string; args?: SpendingQuery; id?: string }; thoughtSignature?: string };
type Content = { role: "user" | "model"; parts: Record<string, unknown>[] };

const c = MAIN_CUSTOMER;
const CATEGORIES = Object.keys(c.basketOf).sort();
const eur = (n: number) => `€${Math.round(n).toLocaleString("en-US")}`;

function customerContext() {
  const s = safeToSpend(c);
  const el = SAVED_READINGS.electricity;
  const pf = portfolio();
  const cmp = compare({
    annualKwh: el.annualConsumptionKwh ?? 6500,
    centsPerKwh: el.priceCentsPerKwh ?? 0,
    monthlyFee: el.monthlyFee ?? 0,
    centsAfterEnd: el.priceAfterEndCentsPerKwh,
    monthlyFeeAfterEnd: el.monthlyFeeAfterEnd,
  });
  const byCategory = Object.entries(c.summary.categoryYear)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, y]) => `- ${cat} (basket ${c.basketOf[cat]}): ${eur(y / 12)}/month, ${eur(y)}/year`)
    .join("\n");
  const baskets = ([1, 2, 3] as Basket[])
    .map((b) => `- Basket ${b} "${BASKET_LABELS[b].title}": ${eur(c.summary.basketYear[b] / 12)}/month`)
    .join("\n");
  const bills = Object.values(SAVED_READINGS)
    .map((r) => `- ${r.supplier}, ${r.product}: ${eur(r.monthlyCost)}/month. ${r.summary}`)
    .join("\n");

  return `Customer: age ${c.age}, postal code ${c.postalCode} (Espoo). Today is ${c.asOf}. Data covers ${c.transactions[0].date} to ${c.asOf}.

Safe to spend this week (Monday ${s.weekStart} to Sunday): ${eur(s.remaining)} left of a ${eur(s.weeklyBudget)} weekly everyday budget, ${eur(s.spentThisWeek)} spent so far, ${s.daysLeft} days left. Built from: salary ${eur(s.incomePerMonth)}/month, minus fixed and regular bills ${eur(s.fixedRegularPerMonth)}, minus set-aside for irregular costs ${eur(s.irregularSetAsidePerMonth)}, minus savings goal ${eur(s.savingsGoalPerMonth)} (an assumption the user can change). They usually spend ${eur(s.usualWeeklyEveryday)} a week on everyday things.

Three baskets, last 12 months:
${baskets}

By category, last 12 months:
${byCategory}

Bills Solvo has read from the e-invoices in the bank:
${bills}
Electricity: doing nothing costs ${eur(cmp.doNothing)}/year after the rollover. Best fixed offer is ${cmp.recommended.supplier} ${cmp.recommended.product} at ${eur(cmp.recommended.yearly)}/year, saving ${eur(cmp.recommended.saving)}/year (about ${eur(cmp.recommended.saving / 52)} a week more to spend). The user can switch with one tap in the Bills view after approving.

Unpaid bill: ${UNPAID.supplier}, ${eur(UNPAID.amount)} (${UNPAID.what}), was due ${UNPAID.dueDate} and is still open. It belongs to basket 2 (irregular costs), so paying it comes from the irregular set-aside and doesn't lower this week's safe-to-spend. Paying before the reminder avoids a reminder fee. If the user can't pay now, suggest calling the clinic to ask for a later due date or an instalment plan, and that an S-Pankki advisor can help. Solvo is a coach, not a debt collector.

Fund holdings (S-Pankki funds, demo values): ${pf.holdings.map((h) => `${fundById(h.fundId).name}, put in ${eur(h.invested)} since ${h.since}, worth ${eur(h.value)} (${h.yearChangePct.toFixed(1)} % in 12 months)`).join("; ")}. Total worth ${eur(pf.value)} on ${eur(pf.invested)} put in (${pf.gainPct.toFixed(1)} %), ${pf.yearChangePct.toFixed(1)} % in the last 12 months. No new fund deposits since 2023. The Save tab can set up a monthly plan. Never recommend a specific fund or predict returns: Solvo doesn't give investment advice.`;
}

const SYSTEM = `You are Solvo, a friendly money coach inside the S-Pankki bank app. You talk to one customer about their own money.

Rules:
- Answer in the language the user writes in (Finnish or English).
- Keep it short: at most 3 short sentences, about 60 words. Plain text, no markdown, no lists, no headings. Do not end with filler like "let me know if...".
- Every euro amount about past spending must come from the spending tool or the context below. Never estimate or invent numbers. Round to whole euros, written like €84.
- For questions about a type of spending (taxis, restaurants, groceries, a month, a period), call the spending tool. Pick merchantType for specific things like taxis, fuel, bars or cinema, and category for broad groups. Without a period, use the last 12 months (the default).
- The bank data shows categories and merchant types, not shop names. If asked about a specific shop, say so and give the closest merchant type.
- Be warm and practical, never judgemental. Give one concrete next step when it helps, such as a realistic weekly limit or opening the Bills view to switch electricity.
- You never move money or switch contracts yourself. Switches happen only when the user approves them in the app.
- No investment, loan or tax advice. Say a human advisor at S-Pankki can help.

${customerContext()}`;

const TOOLS = [
  {
    functionDeclarations: [
      {
        name: "spending",
        description:
          "Exact spending totals from the customer's real bank transactions. Returns total EUR spent, number of purchases, averages, optional breakdown and the largest purchases.",
        parameters: {
          type: "OBJECT",
          properties: {
            category: { type: "STRING", enum: CATEGORIES, description: "Broad spending category." },
            merchantType: { type: "STRING", enum: MERCHANT_TYPE_NAMES, description: "Specific kind of merchant, e.g. Taxis." },
            from: { type: "STRING", description: "Start date YYYY-MM-DD, inclusive. Default: 12 months ago." },
            to: { type: "STRING", description: "End date YYYY-MM-DD, inclusive. Default: today." },
            groupBy: { type: "STRING", enum: ["month", "category", "merchantType", "none"], description: "Optional breakdown." },
          },
        },
      },
    ],
  },
];

async function gemini(model: string, contents: Content[], key: string, signal: AbortSignal) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents,
      tools: TOOLS,
      generationConfig: { temperature: 0.3, thinkingConfig: { thinkingLevel: "low" } },
    }),
    signal,
  });
  if (!res.ok) throw Object.assign(new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`), { status: res.status });
  const data = await res.json();
  const content = data?.candidates?.[0]?.content as { role: "model"; parts?: Part[] } | undefined;
  if (!content?.parts?.length) throw new Error("Gemini returned no content");
  return content as { role: "model"; parts: Part[] };
}

async function askGemini(messages: ChatMessage[], key: string) {
  const signal = AbortSignal.timeout(DEADLINE_MS);
  let lastError: unknown;
  for (const model of MODELS) {
    try {
      return { ...(await converse(model, messages, key, signal)), model };
    } catch (e) {
      lastError = e;
      const status = (e as { status?: number }).status;
      if (status !== 429 && status !== 503) throw e;
    }
  }
  throw lastError;
}

async function converse(model: string, messages: ChatMessage[], key: string, signal: AbortSignal) {
  const contents: Content[] = messages.map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.text }],
  }));
  const checks: SpendingResult[] = [];

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const reply = await gemini(model, contents, key, signal);
    const calls = reply.parts.filter((p) => p.functionCall);
    if (!calls.length || round === MAX_TOOL_ROUNDS) {
      const answer = reply.parts
        .map((p) => p.text ?? "")
        .join("")
        .trim();
      if (!answer) throw new Error("Gemini returned no answer");
      return { answer, checks };
    }
    // Send the model turn back unchanged (it carries Gemini's thought signatures), then the tool results.
    contents.push(reply as Content);
    contents.push({
      role: "user",
      parts: calls.map(({ functionCall }) => {
        const result = spending(c, functionCall!.args ?? {});
        checks.push(result);
        return { functionResponse: { name: functionCall!.name, id: functionCall!.id, response: { result } } };
      }),
    });
  }
  throw new Error("unreachable");
}

// Offline fallback: answers simple "how much did I spend on X" questions without the model,
// so the demo still works if Gemini is down.
const KEYWORDS: [RegExp, SpendingQuery][] = [
  [/taxi|taksi|uber|bolt/i, { merchantType: "Taxis" }],
  [/restaurant|ravintol|syöm|eating out/i, { category: "Restaurants" }],
  [/grocer|ruoka|kauppa|supermarket/i, { category: "Groceries" }],
  [/bar|baari|drink|juom/i, { merchantType: "Bars and nightlife" }],
  [/fuel|bensa|polttoaine|petrol/i, { category: "Transportation" }],
  [/fast food|cafe|kahvi|pikaruoka/i, { merchantType: "Fast food and cafes" }],
  [/cinema|elokuv|leffa/i, { merchantType: "Cinema" }],
  [/entertain|viihde/i, { category: "Entertainment" }],
  [/travel|matka|hotel/i, { category: "Travel" }],
];

function offlineAnswer(question: string) {
  const fi = /[äö]|paljon|kuinka|mihin/i.test(question);
  const hit = KEYWORDS.find(([re]) => re.test(question));
  if (!hit) {
    return {
      answer: fi
        ? "En saa juuri nyt yhteyttä tekoälyyn. Kysy esimerkiksi, paljonko käytit takseihin tai ravintoloihin."
        : "I can't reach the AI right now. Try asking how much you spent on taxis or restaurants.",
      checks: [],
    };
  }
  const r = spending(c, hit[1]);
  const what = hit[1].merchantType ?? hit[1].category!;
  return {
    answer: fi
      ? `Viimeisen 12 kuukauden aikana käytit ${eur(r.total)} (${what}), ${r.count} ostoa eli noin ${eur(r.averagePerMonth)} kuukaudessa.`
      : `In the last 12 months you spent ${eur(r.total)} on ${what.toLowerCase()}, ${r.count} purchases, about ${eur(r.averagePerMonth)} a month.`,
    checks: [r],
  };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { messages?: ChatMessage[] };
  const messages = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "coach") && typeof m.text === "string" && m.text.trim())
    .slice(-10)
    .map((m) => ({ role: m.role, text: m.text.slice(0, 1000) }));
  const last = messages.at(-1);
  if (!last || last.role !== "user") return Response.json({ error: "No question" }, { status: 400 });

  const started = Date.now();
  const key = process.env.GEMINI_API_KEY;
  if (key) {
    try {
      const out = await askGemini(messages, key);
      return Response.json({ ...out, source: "gemini", ms: Date.now() - started });
    } catch (e) {
      return Response.json({ ...offlineAnswer(last.text), source: "offline", ms: Date.now() - started, error: String(e) });
    }
  }
  return Response.json({ ...offlineAnswer(last.text), source: "offline", ms: 0, error: "GEMINI_API_KEY not set" });
}
