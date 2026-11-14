import data from "@/data/lookalike.json";
import { DEFAULT_SAVINGS_GOAL_PER_MONTH } from "@/lib/coach";

// "A customer like you": the peer-review hook. A visitor gives their age and postal code, and we pick
// the closest customer in S-Pankki's synthetic dataset and show what Solvo would see for them.
// Nothing is stored. GET /api/lookalike?age=34&postal=02130

type Row = [string, number, string, number, number, number, number, number, number, number, number, string, number];
const ROWS = data.rows as Row[];

// Share of fixed bills Solvo cut for the main persona (electricity €484 + phone €255 of €2,708 utilities).
const DEMO_SAVING_SHARE = (484 + 255) / 2708;

function areaDistance(a: string, b: string) {
  if (a === b) return 0;
  if (a.slice(0, 3) === b.slice(0, 3)) return 2;
  if (a.slice(0, 2) === b.slice(0, 2)) return 4;
  if (a[0] === b[0]) return 6;
  return 10; // outside the dataset's area: match on age only
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const age = Number(url.searchParams.get("age"));
  const postal = (url.searchParams.get("postal") ?? "").replace(/\D/g, "").padStart(5, "0").slice(0, 5);
  if (!Number.isFinite(age) || age < 16 || age > 100) {
    return Response.json({ error: "Give an age between 16 and 100." }, { status: 400 });
  }

  let best: Row | null = null;
  let bestScore = Infinity;
  for (const r of ROWS) {
    const score = Math.abs(r[1] - age) + areaDistance(r[2], postal);
    if (score < bestScore) {
      best = r;
      bestScore = score;
    }
  }
  if (!best) return Response.json({ error: "No match" }, { status: 404 });

  const [id, cAge, cPostal, salaryYear, b1, b2, b3, utilitiesYear, utilityPayments, restaurantsYear, taxiYear, topLeak, topLeakYear] = best;
  const everydayPerMonth = salaryYear / 12 - b1 / 12 - b2 / 12 - DEFAULT_SAVINGS_GOAL_PER_MONTH;
  const weeklyBudget = everydayPerMonth / (52 / 12);
  const estimatedSaving = utilitiesYear * DEMO_SAVING_SHARE;

  return Response.json({
    id,
    age: cAge,
    postal: cPostal,
    samePostal: cPostal === postal,
    period: { from: data.from, to: data.to },
    salaryYear,
    baskets: { 1: b1, 2: b2, 3: b3 },
    utilitiesYear,
    utilityPayments,
    restaurantsYear,
    taxiYear,
    topLeak,
    topLeakYear,
    weeklyBudget,
    usualWeekly: b3 / 52,
    estimatedSaving,
    estimatedSavingPerWeek: estimatedSaving / 52,
  });
}
