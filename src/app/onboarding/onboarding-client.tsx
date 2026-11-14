"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, Check, ExternalLink, Home, Pencil, PiggyBank, Plane, Plus, Sprout, Trash2, Wallet } from "lucide-react";
import { ApproveSheet, StickyAction } from "@/app/bills/switch-ui";
import { NumberField, Stepper } from "@/components/solvo/fields";
import { MoneyBadge, SignedAmount } from "@/components/solvo/money-badge";
import { Sheet } from "@/components/solvo/sheet";
import { BackButton, Chip, Group, IconTile, PAGE, PageTitle, Row, Slab, TopBar, eur } from "@/components/solvo/ui";
import { CATALOG, HORIZON_LABEL, RISK_WORDS, SAFETY_LABEL, matchFunds, type CatalogFund, type Horizon, type Prefs, type Safety } from "@/lib/fund-match";
import { saveOnboarding, skipOnboarding } from "@/lib/onboarding-store";
import { SPANKKI_FUNDS_FETCHED } from "@/lib/spankki-funds";
import { buildPlan, type Goal, type GoalKind, type PlanBase } from "@/lib/plan";
import { STATUS_LABEL, type Profile, type Status } from "@/lib/profile";
import { ordinal, type Item, type Schedule } from "@/lib/schedule";

// First run, four steps: 1 your profile (accept it or fix it), 2 savings goals, 3 investing, 4 your plan.
// Output: a weekly spending budget, a monthly transfer to a savings account, a monthly room for investing, and what
// Solvo would move on payday. Transfers are simulated in the demo and need the person's approval.

type Base = Omit<PlanBase, "status">;
const STEPS = 4;

const LEARN = [
  { title: "Savings and investments", by: "Finanssivalvonta, the financial supervisor", href: "https://www.finanssivalvonta.fi/en/consumers/savings-and-investments/" },
  { title: "Know the risks and scams in investing", by: "Taloustaito, financial education (in Finnish)", href: "https://www.taloustaito.fi/Rahat/saastaja-tunnista-sijoitusten-riskien-ja-huijausten-erot/" },
];
const ASP_LINK = { title: "How to get your own home", href: "https://www.taloustaito.fi/nuoret-ja-raha/nain-voit-paasta-kiinni-omaan-asuntoon/" };

const GOAL_PRESETS: Record<GoalKind, { label: string; target: number; months: number }> = {
  asp: { label: "Home savings (ASP)", target: 20000, months: 36 },
  trip: { label: "A trip", target: 800, months: 12 },
  other: { label: "Something else", target: 500, months: 12 },
};

const radioRow = "flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left [&+&]:border-t";
const enter = "animate-in fade-in slide-in-from-right-4 duration-300 motion-reduce:animate-none";

function Radio({ on }: { on: boolean }) {
  return (
    <span className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? "border-primary bg-primary" : "border-border"}`} aria-hidden>
      {on && <span className="size-2 rounded-full bg-white" />}
    </span>
  );
}

function Choice({ on, title, sub, onClick }: { on: boolean; title: string; sub?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={radioRow} aria-pressed={on}>
      <Radio on={on} />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium">{title}</span>
        {sub && <span className="block text-[13px] text-muted-foreground">{sub}</span>}
      </span>
    </button>
  );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T | null; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-2 p-4">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          className={`h-11 flex-1 rounded-xl px-2 text-[15px] font-semibold ${value === o.id ? "bg-primary text-primary-foreground" : "bg-muted"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** The small pencil. 44px target, so it is easy to hit on a phone. */
function EditButton({ label, onClick, dark = false }: { label: string; onClick: () => void; dark?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`flex size-11 shrink-0 items-center justify-center rounded-full active:scale-95 ${dark ? "bg-white/12 text-white" : "bg-muted text-foreground"}`}
    >
      <Pencil className="size-4" aria-hidden />
    </button>
  );
}

function EditableRow({ icon, title, subtitle, value, valueSub, onEdit, editLabel }: { icon: ReactNode; title: string; subtitle?: string; value: ReactNode; valueSub?: string; onEdit: () => void; editLabel: string }) {
  return (
    <div className="flex min-h-14 items-center gap-3 py-2 pr-2 pl-4 [&+&]:border-t">
      {icon}
      <div className="min-w-0 flex-1">
        <div className="text-[15px] leading-snug font-medium">{title}</div>
        {subtitle && <div className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{subtitle}</div>}
      </div>
      <div className="shrink-0 text-right">
        <div className="text-[15px]">{value}</div>
        {valueSub && <div className="mt-0.5 text-[12px] text-muted-foreground">{valueSub}</div>}
      </div>
      <EditButton label={editLabel} onClick={onEdit} />
    </div>
  );
}

function ExternalCard({ title, by, href }: { title: string; by: string; href: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="flex min-h-14 items-center gap-3 px-4 py-3 [&+&]:border-t">
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium">{title}</span>
        <span className="block text-[13px] text-muted-foreground">{by}</span>
      </span>
      <ExternalLink className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </a>
  );
}

type SheetName = "situation" | "income" | "bills" | null;

// "Helvi Energia Oy · Around the 25th" when the company is known, otherwise just the usual day.
const billSub = (i: Item) => {
  const when = `Around the ${ordinal(i.day)}`;
  return i.detail && !/^Bank data/.test(i.detail) ? `${i.detail} · ${when}` : when;
};

export function OnboardingClient({ profile, base, schedule, local }: { profile: Profile; base: Base; schedule: Schedule; local: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [sheet, setSheet] = useState<SheetName>(null);
  const [status, setStatus] = useState<Status>(profile.status);
  const [income, setIncomeState] = useState(base.incomeMonthly);
  const [items, setItems] = useState<Item[]>(schedule.items);
  const [billsEdited, setBillsEdited] = useState(false);
  const [paydayDay, setPaydayDay] = useState(schedule.payday?.day ?? 25);
  const [investsNow, setInvestsNow] = useState<boolean | null>(profile.investsMonthly >= 10 ? true : null);
  const [interest, setInterest] = useState<"yes" | "later" | "no" | null>(null);
  const [prefs, setPrefs] = useState<Prefs>({ safety: "balanced", green: true, horizon: "mid" });
  const [goals, setGoals] = useState<Goal[]>([]);
  const [savedFunds, setSavedFunds] = useState<string[]>([]);
  const [startFund, setStartFund] = useState<CatalogFund | null>(null);
  const [confirming, setConfirming] = useState(false);

  const outItems = items.filter((i) => i.kind === "out");
  // The total always equals the bills listed, so the screens agree. Fall back to the data's total only if none were found.
  const fixed = outItems.length || billsEdited ? outItems.reduce((s, i) => s + i.amount, 0) : base.fixedRegularMonthly;
  const plan = buildPlan({ ...base, incomeMonthly: income, fixedRegularMonthly: fixed, status }, { investsNow, investInterest: interest, goals });
  const wantsToInvest = investsNow === true || interest === "yes" || interest === "later";
  const { matches, why } = matchFunds(prefs);
  const saved = CATALOG.filter((f) => savedFunds.includes(f.id));

  const next = () => setStep((s) => Math.min(STEPS, s + 1));
  const back = () => setStep((s) => Math.max(1, s - 1));
  const leave = () => {
    skipOnboarding();
    router.push("/");
  };
  const toggleFund = (id: string) => setSavedFunds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  // Keep the salary item (and so the calendar) in step with what the person confirms.
  const upsertSalary = (patch: Partial<Item>) =>
    setItems((its) => {
      const has = its.some((i) => i.id === "salary");
      const rest = has ? its.map((i) => (i.id === "salary" ? { ...i, ...patch, source: "you" as const } : i)) : [{ id: "salary", label: "Salary", kind: "in" as const, day: paydayDay, amount: income, source: "you" as const, ...patch }, ...its];
      return rest;
    });
  const setIncome = (n: number) => {
    setIncomeState(n);
    upsertSalary({ amount: n });
  };
  const setPayday = (d: number) => {
    setPaydayDay(d);
    upsertSalary({ day: d });
  };
  const patchItem = (id: string, patch: Partial<Item>) => {
    setBillsEdited(true);
    setItems((its) => its.map((i) => (i.id === id ? { ...i, ...patch, source: "you" as const } : i)));
  };
  const removeItem = (id: string) => {
    setBillsEdited(true);
    setItems((its) => its.filter((i) => i.id !== id));
  };
  const addBill = () => {
    setBillsEdited(true);
    setItems((its) => [...its, { id: `bill-${Date.now()}`, label: "New bill", kind: "out", day: 1, amount: 0, source: "you" }]);
  };

  const addGoal = (kind: GoalKind) => {
    const p = GOAL_PRESETS[kind];
    setGoals((g) => [...g, { id: `${kind}-${Date.now()}`, kind, label: p.label, target: p.target, saved: 0, months: p.months }]);
  };
  const patchGoal = (id: string, patch: Partial<Goal>) => setGoals((gs) => gs.map((g) => (g.id === id ? { ...g, ...patch } : g)));

  const skip = (
    <button type="button" onClick={leave} className="-ml-2 flex h-11 items-center rounded-full px-2 text-[15px] font-medium text-muted-foreground active:bg-muted">
      Skip for now
    </button>
  );
  const top = <TopBar back={step > 1 ? <BackButton onClick={back} label="Back" /> : skip} />;
  const progress = (
    <div className="mt-2 flex gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS} aria-valuenow={step} aria-label={`Step ${step} of ${STEPS}`}>
      {Array.from({ length: STEPS }, (_, i) => (
        <span key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < step ? "bg-primary" : "bg-border"}`} />
      ))}
    </div>
  );
  const wrap = `${PAGE} pb-[calc(6rem+env(safe-area-inset-bottom))]`;
  const localBanner = local && <p className="mt-2 rounded-md bg-red-950 px-3 py-2 text-center text-xs font-medium text-red-50">My Nordea data, local only.</p>;

  // ---------- 1. Your profile ----------
  if (step === 1) {
    const unsure = profile.confidence === "low";
    return (
      <main className={wrap}>
        {top}
        {progress}
        {localBanner}
        <div key="s1" className={enter}>
          <PageTitle title={unsure ? "We're not sure about you yet" : "Here's you"}>We built this from your last 12 months. Fix anything that is off with the pencil.</PageTitle>

          <Slab>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] text-white/70">Your situation</p>
                <p className="mt-1 font-display text-[30px] leading-tight font-semibold tracking-[-0.02em]">{STATUS_LABEL[status]}</p>
              </div>
              <EditButton dark label="Edit your situation" onClick={() => setSheet("situation")} />
            </div>
            <p className="mt-3 border-t border-white/10 pt-3 text-[13px] text-white/65">
              {status !== profile.status ? "Changed by you" : profile.confidence === "high" ? "We're fairly sure" : profile.confidence === "medium" ? "A reasonable guess" : "Just a guess"}
            </p>
          </Slab>

          <Group title="Money in">
            <EditableRow
              icon={<MoneyBadge kind="in" />}
              title="Income"
              subtitle={`Arrives around the ${ordinal(paydayDay)}`}
              value={<SignedAmount kind="in" value={income} />}
              valueSub="a month"
              onEdit={() => setSheet("income")}
              editLabel="Edit income and payday"
            />
          </Group>

          <Group
            title="Fixed bills"
            aside={<EditButton label="Edit fixed bills" onClick={() => setSheet("bills")} />}
            footer={`${eur.format(fixed)} a month. On payday Solvo sets this aside so the bills are covered.`}
          >
            {outItems.length ? (
              outItems.map((i) => <Row key={i.id} icon={<MoneyBadge kind="out" />} title={i.label} subtitle={billSub(i)} value={<SignedAmount kind="out" value={i.amount} />} />)
            ) : (
              <p className="px-4 py-4 text-[14px] text-muted-foreground">No fixed bills found. Add yours with the pencil.</p>
            )}
          </Group>

          <Group title="Everyday spending">
            <Row icon={<IconTile tone="grey"><Wallet /></IconTile>} title="What you usually spend" subtitle="Food, transport, fun" value={eur.format(base.everydayMonthly)} valueSub="a month" />
          </Group>

          <details className="mt-5 rounded-2xl bg-card px-4 py-3 text-[14px] shadow-[0_1px_3px_rgba(15,42,31,0.06)]">
            <summary className="flex min-h-11 cursor-pointer items-center font-medium">Why we think so</summary>
            <ul className="mt-1 flex flex-col gap-2 pb-2 text-muted-foreground">
              {profile.evidence.map((e) => (
                <li key={e} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  {e}
                </li>
              ))}
              {schedule.payday && (
                <li className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  Your salary usually arrives around the {ordinal(schedule.payday.day)}.
                </li>
              )}
            </ul>
          </details>
        </div>

        <StickyAction onClick={next}>Looks right</StickyAction>

        {sheet === "situation" && (
          <Sheet title="Your situation" onClose={() => setSheet(null)}>
            <div className="overflow-hidden rounded-2xl bg-muted/50">
              {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                <Choice key={s} on={status === s} title={STATUS_LABEL[s]} onClick={() => setStatus(s)} />
              ))}
            </div>
          </Sheet>
        )}
        {sheet === "income" && (
          <Sheet title="Income and payday" onClose={() => setSheet(null)}>
            <div className="flex flex-col gap-5">
              <NumberField label="Income a month" value={income} onChange={setIncome} suffix="€" />
              <Stepper label="Salary arrives on the" value={paydayDay} min={1} max={31} onChange={setPayday} format={ordinal} />
              <p className="text-[13px] leading-snug text-muted-foreground">
                {schedule.payday ? "We guessed the day from when your salary usually arrives." : "We could not find a regular salary, so this is a guess."} If payday falls on a weekend or
                holiday, set the day you actually get paid.
              </p>
            </div>
          </Sheet>
        )}
        {sheet === "bills" && (
          <Sheet title="Fixed bills" onClose={() => setSheet(null)}>
            <div className="flex flex-col gap-4">
              {outItems.map((i) => (
                <div key={i.id} className="flex flex-col gap-2 rounded-2xl bg-muted/60 p-3">
                  <div className="flex items-center gap-2">
                    <input
                      value={i.label}
                      onChange={(e) => patchItem(i.id, { label: e.target.value })}
                      aria-label="Bill name"
                      autoComplete="off"
                      className="h-11 min-w-0 flex-1 rounded-xl bg-card px-3 outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    <button type="button" aria-label={`Remove ${i.label}`} onClick={() => removeItem(i.id)} className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-card active:scale-95">
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>
                  <div className="flex items-end gap-3">
                    <NumberField label="Amount" value={i.amount} onChange={(n) => patchItem(i.id, { amount: n })} suffix="€" />
                    <Stepper label="Day" value={i.day} min={1} max={31} onChange={(d) => patchItem(i.id, { day: d })} format={ordinal} />
                  </div>
                </div>
              ))}
              <button type="button" onClick={addBill} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-muted text-[15px] font-semibold active:scale-[0.98]">
                <Plus className="size-4" aria-hidden />
                Add a bill
              </button>
            </div>
          </Sheet>
        )}
      </main>
    );
  }

  // ---------- 2. Saving goals ----------
  if (step === 2) {
    return (
      <main className={wrap}>
        {top}
        {progress}
        <div key="s2" className={enter}>
          <PageTitle title="Saving for something?">Add what you are saving for. Solvo works out how much to move each month.</PageTitle>
          <Group>
            <div className="flex flex-wrap gap-2 p-4">
              {(["asp", "trip", "other"] as GoalKind[]).map((k) => (
                <button key={k} type="button" onClick={() => addGoal(k)} className="flex h-11 items-center gap-1.5 rounded-xl bg-muted px-3 text-[15px] font-semibold active:scale-[0.98]">
                  <Plus className="size-4" aria-hidden />
                  {k === "asp" ? "Home (ASP)" : k === "trip" ? "A trip" : "Something else"}
                </button>
              ))}
            </div>
          </Group>

          {goals.map((g, i) => {
            const line = plan.goals[i];
            return (
              <Group
                key={g.id}
                title={
                  <span className="flex items-center gap-2">
                    {g.kind === "asp" ? <Home className="size-4" aria-hidden /> : g.kind === "trip" ? <Plane className="size-4" aria-hidden /> : <PiggyBank className="size-4" aria-hidden />}
                    {g.label}
                  </span>
                }
                aside={
                  <button type="button" aria-label={`Remove ${g.label}`} onClick={() => setGoals((gs) => gs.filter((x) => x.id !== g.id))} className="flex size-11 items-center justify-center">
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                }
                footer={
                  g.kind === "asp" ? (
                    <>
                      ASP rules changed in June 2026. Banks have typically wanted about 10% of the price saved. Check current terms with your bank.{" "}
                      <a href={ASP_LINK.href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                        {ASP_LINK.title}
                      </a>
                      .
                    </>
                  ) : undefined
                }
              >
                <div className="flex flex-col gap-3 p-4">
                  {g.kind === "other" && (
                    <label className="flex flex-col gap-1">
                      <span className="text-[13px] text-muted-foreground">What for</span>
                      <input value={g.label} onChange={(e) => patchGoal(g.id, { label: e.target.value })} autoComplete="off" className="h-11 rounded-xl bg-muted px-3 outline-none focus:ring-2 focus:ring-primary/40" />
                    </label>
                  )}
                  <div className="flex gap-3">
                    <NumberField label="Target" value={g.target} onChange={(n) => patchGoal(g.id, { target: n })} suffix="€" />
                    <NumberField label="Already saved" value={g.saved} onChange={(n) => patchGoal(g.id, { saved: n })} suffix="€" />
                  </div>
                  <NumberField label="Months to go" value={g.months} onChange={(n) => patchGoal(g.id, { months: Math.max(1, n) })} suffix="months" />
                  {line && (
                    <p className="text-[14px] leading-snug">
                      {line.fits ? (
                        <>
                          <span className="num font-semibold">{eur.format(line.monthly)}</span> a month gets you there on time.
                        </>
                      ) : line.monthly > 0 ? (
                        <>
                          You can afford <span className="num font-semibold">{eur.format(line.monthly)}</span> of the {eur.format(line.needed)} a month needed. That takes {line.reachableInMonths} months.
                        </>
                      ) : (
                        <>This needs {eur.format(line.needed)} a month and nothing is spare yet. Try a later date.</>
                      )}
                    </p>
                  )}
                </div>
              </Group>
            );
          })}

          {plan.buffer.need > 0 && (
            <Group footer={`A starter buffer is one month of must-pay costs, ${eur.format(plan.buffer.target)}. It comes before goals and investing.`}>
              <Row icon={<IconTile><PiggyBank /></IconTile>} title="Starter buffer" subtitle={`You have about ${eur.format(plan.buffer.have)} on the account`} value={`${eur.format(plan.buffer.monthly)}/mo`} />
            </Group>
          )}
        </div>
        <StickyAction onClick={next}>{goals.length ? "Continue" : "No goals right now"}</StickyAction>
      </main>
    );
  }

  // ---------- 3. Investing ----------
  if (step === 3) {
    const before = plan.investCeilingBeforeGoals;
    return (
      <main className={wrap}>
        {top}
        {progress}
        <div key="s3" className={enter}>
          <PageTitle title="Investing">Solvo works out how much is sensible to set aside. You choose where it goes.</PageTitle>

          <Slab>
            <p className="text-[15px] text-white/70">Room for investing, from your earnings</p>
            <p className="num mt-1 font-display text-[56px] leading-none font-semibold tracking-[-0.035em]">{before > 0 ? `${eur.format(before)}/mo` : "Not yet"}</p>
            <p className="mt-4 border-t border-white/10 pt-3 text-[13px] leading-snug text-white/65">
              {before > 0
                ? goals.length
                  ? `After your savings goals: ${plan.investCeiling > 0 ? `${eur.format(plan.investCeiling)}/mo` : "nothing left yet"}.`
                  : "After your bills and a buffer. Half of what is left; the rest stays as slack."
                : (plan.notes[0] ?? "Nothing is spare after your bills yet.")}
            </p>
          </Slab>

          <Group title="How we worked it out">
            <Row title="Income" value={<SignedAmount kind="in" value={income} />} />
            <Row title="Fixed bills" value={<SignedAmount kind="out" value={fixed} />} />
            <Row title="Irregular costs set aside" subtitle="Health, travel, home and tech" value={<SignedAmount kind="out" value={base.irregularMonthly} />} />
            <Row title="Everyday spending kept" subtitle="85% of what you usually spend" value={<SignedAmount kind="out" value={plan.everydayFloor} />} />
            <Row title="Room for saving and investing" value={eur.format(plan.room)} className="font-semibold" />
            {plan.buffer.monthly > 0 && <Row title="Starter buffer" value={<SignedAmount kind="out" value={plan.buffer.monthly} />} />}
            {goals.length > 0 && <Row title="Your savings goals" value={<SignedAmount kind="out" value={plan.goals.reduce((s, g) => s + g.monthly, 0)} />} />}
            <Row title="Sensible to invest" subtitle="Half of what is left" value={`${eur.format(plan.investCeiling)}/mo`} className="font-semibold" />
          </Group>

          <Group title="Do you invest today?" footer={profile.investsMonthly >= 10 ? `We see about ${eur.format(profile.investsMonthly)} a month going to investing.` : undefined}>
            <Segmented value={investsNow === null ? null : investsNow ? "yes" : "no"} options={[{ id: "yes", label: "Yes" }, { id: "no", label: "No" }]} onChange={(v) => setInvestsNow(v === "yes")} />
          </Group>

          {investsNow === false && (
            <Group title="Would you like to start?">
              <Segmented value={interest} options={[{ id: "yes", label: "Yes" }, { id: "later", label: "Later" }, { id: "no", label: "No" }]} onChange={setInterest} />
            </Group>
          )}

          {wantsToInvest && (
            <>
              <Group title="What matters to you?">
                {(Object.keys(SAFETY_LABEL) as Safety[]).map((s) => (
                  <Choice key={s} on={prefs.safety === s} title={SAFETY_LABEL[s].title} sub={SAFETY_LABEL[s].blurb} onClick={() => setPrefs((p) => ({ ...p, safety: s }))} />
                ))}
              </Group>
              <Group title="When might you need this money?">
                {(Object.keys(HORIZON_LABEL) as Horizon[]).map((h) => (
                  <Choice key={h} on={prefs.horizon === h} title={HORIZON_LABEL[h].title} onClick={() => setPrefs((p) => ({ ...p, horizon: h }))} />
                ))}
              </Group>
              <Group>
                <button type="button" role="switch" aria-checked={prefs.green} onClick={() => setPrefs((p) => ({ ...p, green: !p.green }))} className={radioRow}>
                  <IconTile><Sprout /></IconTile>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium">Environmentally friendly</span>
                    <span className="block text-[13px] text-muted-foreground">Only funds with an EU sustainability label</span>
                  </span>
                  <span className={`flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 ${prefs.green ? "bg-primary" : "bg-border"}`} aria-hidden>
                    <span className={`size-6 rounded-full bg-white shadow transition-transform ${prefs.green ? "translate-x-5" : ""}`} />
                  </span>
                </button>
              </Group>

              <Group title="Funds that fit" aside={`${matches.length} found`} footer={`S-Pankki funds, fetched ${SPANKKI_FUNDS_FETCHED}. Real estate and forest funds are left out: they trade only on set dates. Information, not advice. Funds can lose value.`}>
                {matches.length ? (
                  matches.map(({ fund, minYears }) => {
                    const on = savedFunds.includes(fund.id);
                    return (
                      <div key={fund.id} className="flex items-start gap-2 py-3 pr-2 pl-4 [&+&]:border-t">
                        <div className="min-w-0 flex-1">
                          <p className="text-[15px] font-medium">{fund.name}</p>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            <Chip tone={fund.risk >= 5 ? "warn" : "grey"}>
                              Risk {fund.risk}/7 · {RISK_WORDS[fund.risk]}
                            </Chip>
                            {fund.sfdr !== "none" && <Chip tone="green">EU {fund.sfdr}</Chip>}
                          </div>
                          <p className="mt-1.5 text-[13px] leading-snug text-muted-foreground">
                            {fund.what} Costs {fund.yearlyFeePct.toLocaleString("fi-FI")} % a year{fund.buyingFeePct > 0 ? `, ${fund.buyingFeePct.toLocaleString("fi-FI")} % to buy` : ""}.{" "}
                            {fund.minMonthly ? `From ${eur.format(fund.minMonthly)} a month. ` : fund.minOneOff ? `From ${eur.format(fund.minOneOff)}. ` : ""}
                            Keep it {minYears}+ {minYears === 1 ? "year" : "years"}.
                          </p>
                        </div>
                        <button
                          type="button"
                          aria-pressed={on}
                          aria-label={on ? `Remove ${fund.name} from your list` : `Save ${fund.name} to your list`}
                          onClick={() => toggleFund(fund.id)}
                          className="flex size-11 shrink-0 items-center justify-center rounded-full active:bg-muted"
                        >
                          <Bookmark className={`size-5 ${on ? "fill-primary text-primary" : "text-muted-foreground"}`} aria-hidden />
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <p className="px-4 py-4 text-[14px] leading-snug text-muted-foreground">Nothing fits all of that at once. Try a longer horizon, a little more risk, or turn the green filter off.</p>
                )}
                {why.length > 0 && (
                  <div className="border-t px-4 py-3 text-[13px] leading-snug text-muted-foreground">
                    {why.map((w) => (
                      <p key={w}>{w}</p>
                    ))}
                  </div>
                )}
              </Group>

              <Group title="Learn the basics first" footer="Neutral sources. They open in a new tab.">
                {LEARN.map((l) => (
                  <ExternalCard key={l.href} {...l} />
                ))}
              </Group>
            </>
          )}
        </div>
        <StickyAction onClick={next}>{investsNow === null ? "Skip investing" : "See my plan"}</StickyAction>
      </main>
    );
  }

  // ---------- 4. The plan ----------
  const squeezedPlan = plan.spendMonthly <= 0;
  const savedDetail = saved.length ? saved : [];
  return (
    <main className={wrap}>
      {top}
      {progress}
      <div key="s4" className={enter}>
        <PageTitle title="Your plan">Where your money goes each month, and what Solvo does on payday.</PageTitle>
        <Slab>
          <p className="text-[15px] text-white/70">On your spending account, each week</p>
          <p className="num mt-1 font-display text-[56px] leading-none font-semibold tracking-[-0.035em]">{squeezedPlan ? "—" : eur.format(plan.spendWeekly)}</p>
          <p className="mt-4 border-t border-white/10 pt-3 text-[13px] leading-snug text-white/65">
            {squeezedPlan ? "After bills and saving, nothing is left for everyday spending. Loosen a goal or its date." : `${eur.format(plan.spendMonthly)} a month for everyday spending. This is the number on your home screen.`}
          </p>
        </Slab>

        <Group title={`On payday, the ${ordinal(paydayDay)}`} footer="Solvo splits your salary the day it arrives, with your approval. In this demo nothing really moves.">
          <Row icon={<MoneyBadge kind="in" />} title="Salary arrives" value={<SignedAmount kind="in" value={income} />} />
          <Row icon={<IconTile><Check /></IconTile>} title="Kept safe for bills" subtitle={`${outItems.length} bills, paid on their own dates`} value={eur.format(fixed)} />
          <Row icon={<IconTile><Check /></IconTile>} title="Irregular costs pot" subtitle="Health, travel, home and tech" value={eur.format(base.irregularMonthly)} />
          <Row
            icon={<IconTile><PiggyBank /></IconTile>}
            title="Savings account"
            subtitle={[plan.buffer.monthly > 0 ? "Starter buffer" : "", ...plan.goals.filter((g) => g.monthly > 0).map((g) => g.goal.label)].filter(Boolean).join(", ") || "Nothing to move yet"}
            value={eur.format(plan.savingsMonthly)}
          />
          <Row
            icon={<IconTile><Sprout /></IconTile>}
            title="Investing"
            subtitle={plan.investMonthly > 0 ? "A budget. You choose where." : plan.investCeiling > 0 ? `Room for up to ${eur.format(plan.investCeiling)} when you are ready` : "Not yet"}
            value={eur.format(plan.investMonthly)}
          />
          <Row icon={<IconTile><Wallet /></IconTile>} title="Spending account" subtitle={`${eur.format(Math.max(0, plan.spendWeekly))} a week`} value={eur.format(Math.max(0, plan.spendMonthly))} className="font-semibold" />
        </Group>

        {outItems.length > 0 && (
          <Group title="Bills Solvo keeps safe">
            {outItems.map((i) => (
              <Row key={i.id} icon={<MoneyBadge kind="out" />} title={i.label} subtitle={billSub(i)} value={<SignedAmount kind="out" value={i.amount} />} />
            ))}
          </Group>
        )}

        {savedDetail.length > 0 && (
          <Group title="Funds you saved" footer="You decide. Starting opens S-Pankki's own service, where you confirm. Solvo buys nothing.">
            {savedDetail.map((f) => (
              <div key={f.id} className="flex items-center gap-3 px-4 py-3 [&+&]:border-t">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium">{f.name}</p>
                  <p className="text-[13px] text-muted-foreground">
                    Risk {f.risk}/7 · fee {f.yearlyFeePct.toLocaleString("fi-FI")} %
                  </p>
                </div>
                <button type="button" onClick={() => setStartFund(f)} className="flex h-11 shrink-0 items-center rounded-xl bg-primary px-4 text-[14px] font-semibold text-primary-foreground active:scale-[0.97]">
                  Start saving
                </button>
              </div>
            ))}
          </Group>
        )}

        {plan.notes.length > 0 && (
          <Group title="Good to know">
            {plan.notes.map((n) => (
              <Row key={n} title={n} />
            ))}
          </Group>
        )}
      </div>

      <StickyAction onClick={() => setConfirming(true)}>Apply this plan</StickyAction>

      {startFund && (
        <Sheet
          title="Start monthly saving"
          doneLabel="Open S-Pankki"
          onClose={() => setStartFund(null)}
          onDone={() => {
            const url = startFund.buyUrl ?? startFund.pageUrl;
            if (url) window.open(url, "_blank", "noopener,noreferrer");
            setStartFund(null);
          }}
        >
          <p className="text-[15px] leading-snug">{startFund.name}</p>
          <p className="mt-2 text-[14px] leading-snug text-muted-foreground">
            This opens the fund in S-Pankki&apos;s own service (S-mobiili on your phone). You set up and confirm the saving there, and Solvo buys nothing. Your plan has room for up to{" "}
            {eur.format(plan.investMonthly || plan.investCeiling)} a month.{startFund.minMonthly ? ` The fund accepts monthly saving from ${eur.format(startFund.minMonthly)}.` : ""}
          </p>
        </Sheet>
      )}

      {confirming && (
        <ApproveSheet
          title="You approve this plan"
          points={[
            `${eur.format(Math.max(0, plan.spendWeekly))} a week for spending, which updates the number on your home screen.`,
            `On payday, the ${ordinal(paydayDay)}: ${eur.format(fixed)} kept safe for bills, ${eur.format(plan.savingsMonthly)} to savings, ${eur.format(plan.investMonthly)} set aside for investing.`,
            "Nothing is really transferred in this demo. You can change or stop this any time.",
          ]}
          confirmLabel="Approve"
          onConfirm={() => {
            saveOnboarding({
              status,
              spendWeekly: plan.spendWeekly,
              spendMonthly: plan.spendMonthly,
              savingsMonthly: plan.savingsMonthly,
              bufferMonthly: plan.buffer.monthly,
              investMonthly: plan.investMonthly,
              investCeiling: plan.investCeiling,
              goals: plan.goals.map((g) => ({ label: g.goal.label, monthly: g.monthly })),
              paydayDay,
              billsSafeMonthly: fixed,
              // What the person's corrections add to the monthly picture the home page was built on.
              monthlyAdjust: Math.round(income - base.incomeMonthly + (base.fixedRegularMonthly - fixed)),
              irregularMonthly: base.irregularMonthly,
              items,
              savedFunds,
            });
            router.push("/");
          }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </main>
  );
}
