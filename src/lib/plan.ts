// Turns a person's monthly picture plus their answers into three amounts:
//   1. what goes on the spending account each week,
//   2. what goes to a separate savings account each month (starter buffer and goals),
//   3. how much it is sensible to set aside for investing each month.
// Pure maths with no imports, so the server and the browser share it. Every number can be traced to a
// line in `Allocation`, and the UI shows those lines ("how we got there").
//
// Investing: this only sizes a budget. It never picks, ranks or recommends a product. That would be
// investment advice, and the person decides where the money goes.

export const WEEKS_PER_MONTH = 52 / 12;

// Rules of thumb, in one place so the team can argue with the numbers.
const EVERYDAY_FLOOR = 0.85; // everyday spending can be trimmed to 85% of what the person really spends, no further
const BUFFER_MONTHS_TO_BUILD = 6; // build a missing starter buffer over about six months
const BUFFER_SHARE_CAP = 0.4; // but never take more than 40% of the room for saving
const INVEST_SHARE = 0.5; // of what is left after buffer and goals, at most half is "room to invest"; the rest stays as slack

export type PlanBase = {
  incomeMonthly: number;
  fixedRegularMonthly: number; // basket 1: rent, bills
  irregularMonthly: number; // basket 2: set aside for health, travel, home and tech
  everydayMonthly: number; // basket 3: what the person actually spends on everyday things
  cashBalance: number | null; // money on the account today, if known
  investsMonthlyToday: number; // money already moving to investing each month
  status: "worker" | "part-time" | "student" | "between-jobs" | "retired";
};

export type GoalKind = "asp" | "trip" | "other";

export type Goal = {
  id: string;
  kind: GoalKind;
  label: string;
  target: number; // EUR
  saved: number; // EUR already put aside
  months: number; // by when
};

export type Answers = {
  investsNow: boolean | null;
  investInterest: "yes" | "later" | "no" | null; // asked only if not investing
  goals: Goal[];
};

export type GoalLine = {
  goal: Goal;
  needed: number; // EUR a month to hit the date
  monthly: number; // EUR a month the plan can afford
  fits: boolean;
  reachableInMonths: number | null; // at the affordable amount, null if nothing fits
};

export type Allocation = {
  surplus: number; // income minus fixed and irregular costs
  everydayFloor: number; // the least everyday spending the plan assumes
  room: number; // what can go to saving and investing without squeezing everyday spending
  squeezed: boolean; // everyday spending is already above what is left
  buffer: { target: number; have: number; need: number; monthly: number };
  goals: GoalLine[];
  investCeiling: number; // the most it is sensible to invest per month right now (0 if not yet)
  investMonthly: number; // what the plan sets aside for investing
  savingsMonthly: number; // to the separate savings account: buffer plus goals
  spendMonthly: number;
  spendWeekly: number; // the weekly budget on the spending account
  notes: string[];
};

const r0 = (n: number) => Math.round(n);
const down10 = (n: number) => Math.max(0, Math.floor(n / 10) * 10);

export function buildPlan(base: PlanBase, answers: Answers): Allocation {
  const notes: string[] = [];
  const surplus = base.incomeMonthly - base.fixedRegularMonthly - base.irregularMonthly;
  const everydayFloor = base.everydayMonthly * EVERYDAY_FLOOR;
  const squeezed = surplus < everydayFloor;
  const room = Math.max(0, surplus - everydayFloor);

  // Starter buffer: one month of must-pay costs.
  const bufferTarget = base.fixedRegularMonthly + base.irregularMonthly;
  const have = base.cashBalance ?? 0;
  const need = Math.max(0, bufferTarget - have);
  const bufferMonthly = need > 0 ? Math.min(need / BUFFER_MONTHS_TO_BUILD, room * BUFFER_SHARE_CAP) : 0;

  // Goals, in the order the person listed them, from what is left.
  let remaining = room - bufferMonthly;
  const goals: GoalLine[] = answers.goals.map((g) => {
    const toGo = Math.max(0, g.target - g.saved);
    const needed = toGo / Math.max(1, g.months);
    const monthly = Math.max(0, Math.min(needed, remaining));
    remaining -= monthly;
    const fits = monthly >= needed - 0.5;
    return {
      goal: g,
      needed: r0(needed),
      monthly: r0(monthly),
      fits,
      reachableInMonths: monthly > 0 ? Math.ceil(toGo / monthly) : null,
    };
  });

  // Investing: a budget ceiling, only once there is a buffer and income is steady.
  let investCeiling = 0;
  if (base.status === "between-jobs") {
    notes.push("While your income is uncertain, keep money you could need soon in savings, not invested.");
  } else if (need > 0) {
    notes.push("Investing comes after a starter buffer. Money you may need soon should not be exposed to market swings.");
  } else {
    investCeiling = down10(Math.max(0, remaining) * INVEST_SHARE);
  }

  const current = Math.max(0, base.investsMonthlyToday);
  let investMonthly = 0;
  if (answers.investsNow) {
    investMonthly = Math.min(r0(current), Math.max(0, r0(remaining)));
    if (current > investCeiling + 10) {
      notes.push(`You invest about €${r0(current)} a month. That is above the ${investCeiling > 0 ? `€${investCeiling}` : "zero"} the numbers leave room for right now.`);
    }
  } else if (answers.investInterest === "yes") {
    investMonthly = investCeiling;
  }

  const savingsMonthly = r0(bufferMonthly + goals.reduce((s, g) => s + g.monthly, 0));
  const spendMonthly = r0(base.incomeMonthly - base.fixedRegularMonthly - base.irregularMonthly - savingsMonthly - investMonthly);

  if (squeezed) {
    notes.push("What you usually spend on everyday things is already more than what is left after your bills. Start by trimming everyday spending before saving more.");
  }
  if (!goals.length && !need && !investMonthly) notes.push("No savings goals yet. You can add one any time.");

  return {
    surplus: r0(surplus),
    everydayFloor: r0(everydayFloor),
    room: r0(room),
    squeezed,
    buffer: { target: r0(bufferTarget), have: r0(have), need: r0(need), monthly: r0(bufferMonthly) },
    goals,
    investCeiling,
    investMonthly,
    savingsMonthly,
    spendMonthly,
    spendWeekly: r0(spendMonthly / WEEKS_PER_MONTH),
    notes,
  };
}
