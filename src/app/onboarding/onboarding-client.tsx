"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, Home, PiggyBank, Plane, Plus, Sprout, Wallet, X } from "lucide-react";
import { ApproveSheet, StickyAction } from "@/app/bills/switch-ui";
import { BackButton, Chip, Group, IconTile, PAGE, PageTitle, Row, Slab, TopBar, eur, primaryButton, secondaryButton } from "@/components/solvo/ui";
import { HORIZON_LABEL, RISK_WORDS, SAFETY_LABEL, matchFunds, type Horizon, type Prefs, type Safety } from "@/lib/fund-match";
import { saveOnboarding, skipOnboarding } from "@/lib/onboarding-store";
import { buildPlan, type Goal, type GoalKind, type PlanBase } from "@/lib/plan";
import { STATUS_LABEL, type Profile, type Status } from "@/lib/profile";

// First-run flow: 1 what we think of you, 2 your month, 3 savings goals, 4 investing, 5 your plan.
// The output is three amounts: a weekly spending budget, a monthly transfer to a savings account, and a monthly
// room for investing. Transfers are simulated in the demo and need the person's approval.

type Base = Omit<PlanBase, "status">;
const STEPS = 5;

const LEARN = [
  {
    title: "Savings and investments",
    by: "Finanssivalvonta, the financial supervisor",
    href: "https://www.finanssivalvonta.fi/en/consumers/savings-and-investments/",
  },
  {
    title: "Know the risks and scams in investing",
    by: "Taloustaito, financial education (in Finnish)",
    href: "https://www.taloustaito.fi/Rahat/saastaja-tunnista-sijoitusten-riskien-ja-huijausten-erot/",
  },
];
const ASP_LINK = {
  title: "How to get your own home",
  by: "Taloustaito, financial education (in Finnish)",
  href: "https://www.taloustaito.fi/nuoret-ja-raha/nain-voit-paasta-kiinni-omaan-asuntoon/",
};

const GOAL_PRESETS: Record<GoalKind, { label: string; target: number; months: number }> = {
  asp: { label: "Home savings (ASP)", target: 20000, months: 36 },
  trip: { label: "A trip", target: 800, months: 12 },
  other: { label: "Something else", target: 500, months: 12 },
};

const radioRow = "flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left [&+&]:border-t";

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

function NumberField({ label, value, onChange, suffix }: { label: string; value: number; onChange: (n: number) => void; suffix: string }) {
  return (
    <label className="flex flex-1 flex-col gap-1">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className="flex h-11 items-center rounded-xl bg-muted px-3">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
          className="num w-full min-w-0 bg-transparent outline-none"
        />
        <span className="text-[13px] text-muted-foreground">{suffix}</span>
      </span>
    </label>
  );
}

export function OnboardingClient({ profile, base, local }: { profile: Profile; base: Base; local: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<Status>(profile.status);
  const [investsNow, setInvestsNow] = useState<boolean | null>(profile.investsMonthly >= 10 ? true : null);
  const [interest, setInterest] = useState<"yes" | "later" | "no" | null>(null);
  const [prefs, setPrefs] = useState<Prefs>({ safety: "balanced", green: true, horizon: "mid" });
  const [goals, setGoals] = useState<Goal[]>([]);
  const [confirming, setConfirming] = useState(false);

  const plan = buildPlan({ ...base, status }, { investsNow, investInterest: interest, goals });
  const wantsToInvest = investsNow === true || interest === "yes" || interest === "later";
  const { matches, why } = matchFunds(prefs);

  const next = () => setStep((s) => Math.min(STEPS, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));
  const leave = () => {
    skipOnboarding();
    router.push("/");
  };

  const addGoal = (kind: GoalKind) => {
    const p = GOAL_PRESETS[kind];
    setGoals((g) => [...g, { id: `${kind}-${Date.now()}`, kind, label: p.label, target: p.target, saved: 0, months: p.months }]);
  };
  const patchGoal = (id: string, patch: Partial<Goal>) => setGoals((gs) => gs.map((g) => (g.id === id ? { ...g, ...patch } : g)));

  const top = <TopBar back={step > 0 ? <BackButton onClick={back} label="Back" /> : undefined} />;
  const progress =
    step > 0 ? (
      <div className="mt-2 flex gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS} aria-valuenow={step} aria-label={`Step ${step} of ${STEPS}`}>
        {Array.from({ length: STEPS }, (_, i) => (
          <span key={i} className={`h-1 flex-1 rounded-full ${i < step ? "bg-primary" : "bg-border"}`} />
        ))}
      </div>
    ) : null;
  const wrap = `${PAGE} pb-[calc(6rem+env(safe-area-inset-bottom))]`;

  // 0. Welcome
  if (step === 0) {
    return (
      <main className={PAGE}>
        {top}
        {local && <p className="mt-2 rounded-md bg-red-950 px-3 py-2 text-center text-xs font-medium text-red-50">My Nordea data, local only.</p>}
        <PageTitle title="Let's set up your plan">
          Solvo looked at your last 12 months. In a minute you check what we think, and get a weekly budget, a savings amount and room for investing that
          fit you.
        </PageTitle>
        <Group>
          <Row icon={<IconTile><Check /></IconTile>} title="You check every guess" subtitle="We only suggest. You decide." />
          <Row icon={<IconTile><Check /></IconTile>} title="Nothing moves without your approval" subtitle="Transfers are simulated in this demo." />
          <Row icon={<IconTile><Check /></IconTile>} title="No product advice" subtitle="We size a budget and point to neutral learning material." />
        </Group>
        <div className="mt-6 flex flex-col gap-2">
          <button type="button" className={primaryButton} onClick={next}>
            Start
          </button>
          <button type="button" className={secondaryButton} onClick={leave}>
            Skip for now
          </button>
        </div>
      </main>
    );
  }

  // 1. What we think
  if (step === 1) {
    const unsure = profile.confidence === "low";
    return (
      <main className={wrap}>
        {top}
        {progress}
        <PageTitle title={unsure ? "We're not sure yet" : "Here's what we think"}>We built this from your last 12 months. Is it right?</PageTitle>
        <Slab>
          <p className="text-[15px] text-white/70">Your situation</p>
          <p className="mt-1 font-display text-[30px] leading-tight font-semibold tracking-[-0.02em]">{STATUS_LABEL[profile.status]}</p>
          <p className="mt-2 text-[13px] text-white/65">{profile.confidence === "high" ? "We're fairly sure" : profile.confidence === "medium" ? "A reasonable guess" : "Just a guess"}</p>
        </Slab>
        <Group title="Why we think so">
          {profile.evidence.map((e) => (
            <Row key={e} icon={<IconTile><Check /></IconTile>} title={e} />
          ))}
        </Group>
        <Group title="What is true for you?" footer="Your plan changes with this.">
          {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
            <Choice key={s} on={status === s} title={STATUS_LABEL[s]} onClick={() => setStatus(s)} />
          ))}
        </Group>
        <StickyAction onClick={next}>{status === profile.status ? "That's right" : "Use this"}</StickyAction>
      </main>
    );
  }

  // 2. Your month
  if (step === 2) {
    return (
      <main className={wrap}>
        {top}
        {progress}
        <PageTitle title="Your month, as an estimate">From your last 12 months, averaged.</PageTitle>
        <Slab>
          <p className="text-[15px] text-white/70">Left each month after your bills</p>
          <p className="num mt-1 font-display text-[56px] leading-none font-semibold tracking-[-0.035em]">{eur.format(Math.max(0, plan.surplus))}</p>
          <p className="mt-4 border-t border-white/10 pt-3 text-[13px] leading-snug text-white/65">
            You usually spend {eur.format(base.everydayMonthly)} a month on everyday things.
            {plan.squeezed ? " That is more than what is left, so there is nothing spare to save yet." : ""}
          </p>
        </Slab>
        <Group title="How it adds up">
          <Row title="Income" subtitle={status === "student" ? "Salary and study grant" : "Salary"} value={eur.format(base.incomeMonthly)} />
          <Row title="Fixed bills" subtitle="Rent, electricity, phone and internet" value={`−${eur.format(base.fixedRegularMonthly)}`} />
          <Row title="Set aside for irregular costs" subtitle="Health, travel, home and tech" value={`−${eur.format(base.irregularMonthly)}`} />
          <Row title="Left over" value={eur.format(plan.surplus)} className="font-semibold" />
        </Group>
        <StickyAction onClick={next}>Continue</StickyAction>
      </main>
    );
  }

  // 3. Saving goals
  if (step === 3) {
    return (
      <main className={wrap}>
        {top}
        {progress}
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
                <button type="button" aria-label={`Remove ${g.label}`} onClick={() => setGoals((gs) => gs.filter((x) => x.id !== g.id))} className="flex size-9 items-center justify-center">
                  <X className="size-4" aria-hidden />
                </button>
              }
              footer={
                g.kind === "asp" ? (
                  <>
                    ASP rules changed in June 2026. Banks have typically wanted about 10% of the purchase price saved. Check the current terms with your bank.{" "}
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
                    <input value={g.label} onChange={(e) => patchGoal(g.id, { label: e.target.value })} className="h-11 rounded-xl bg-muted px-3 outline-none" />
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
                        You can afford <span className="num font-semibold">{eur.format(line.monthly)}</span> a month of the {eur.format(line.needed)} needed. That reaches it in {line.reachableInMonths} months.
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
          <Group footer={`A starter buffer is one month of must-pay costs (${eur.format(plan.buffer.target)}). It comes before goals and investing.`}>
            <Row icon={<IconTile><PiggyBank /></IconTile>} title="Starter buffer" subtitle={`You have about ${eur.format(plan.buffer.have)} on the account`} value={`${eur.format(plan.buffer.monthly)}/mo`} />
          </Group>
        )}
        <StickyAction onClick={next}>{goals.length ? "Continue" : "No goals right now"}</StickyAction>
      </main>
    );
  }

  // 4. Investing
  if (step === 4) {
    return (
      <main className={wrap}>
        {top}
        {progress}
        <PageTitle title="Investing">Solvo tells you how much it is sensible to set aside. You choose where it goes.</PageTitle>

        <Group title="Do you invest today?" footer={profile.investsMonthly >= 10 ? `We see about ${eur.format(profile.investsMonthly)} a month going to investing.` : undefined}>
          <Segmented value={investsNow === null ? null : investsNow ? "yes" : "no"} options={[{ id: "yes", label: "Yes" }, { id: "no", label: "No" }]} onChange={(v) => setInvestsNow(v === "yes")} />
        </Group>

        {investsNow === false && (
          <Group title="Would you like to start?">
            <Segmented
              value={interest}
              options={[{ id: "yes", label: "Yes" }, { id: "later", label: "Later" }, { id: "no", label: "No" }]}
              onChange={setInterest}
            />
          </Group>
        )}

        {wantsToInvest && (
          <>
            <Slab className="mt-7">
              <p className="text-[15px] text-white/70">Room for investing</p>
              <p className="num mt-1 font-display text-[56px] leading-none font-semibold tracking-[-0.035em]">{plan.investCeiling > 0 ? `${eur.format(plan.investCeiling)}/mo` : "Not yet"}</p>
              <p className="mt-4 border-t border-white/10 pt-3 text-[13px] leading-snug text-white/65">
                {plan.investCeiling > 0
                  ? "The most it is sensible to set aside each month, after your bills, a buffer and your goals. Half of what is left; the other half stays as slack."
                  : plan.notes[0] ?? "There is nothing spare after your bills and goals yet."}
              </p>
            </Slab>

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

            <Group
              title="Funds that match what you told us"
              aside={`${matches.length} found`}
              footer={
                <>
                  Illustrative funds, not real products. This is information, not investment advice: Solvo doesn&apos;t rank or recommend funds. The risk class
                  is the standard 1 to 7 scale from fund fact sheets. Any fund can lose value, also in the short term. The sustainability label (SFDR) describes
                  what a fund reports, not how green it is.
                </>
              }
            >
              {matches.length ? (
                matches.map(({ fund, minYears }) => (
                  <div key={fund.id} className="flex flex-col gap-1.5 px-4 py-3 [&+&]:border-t">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[15px] font-medium">{fund.name}</p>
                      <Chip tone={fund.risk >= 5 ? "warn" : "grey"}>
                        Risk {fund.risk}/7
                      </Chip>
                    </div>
                    <p className="text-[13px] leading-snug text-muted-foreground">{fund.what}</p>
                    <p className="text-[13px] leading-snug text-muted-foreground">
                      {RISK_WORDS[fund.risk]} risk. Keep it invested for about {minYears}+ {minYears === 1 ? "year" : "years"}. Fee {fund.yearlyFeePct.toLocaleString("fi-FI")} % a year.
                      {fund.sfdr !== "none" ? ` EU label: ${fund.sfdr}.` : ""}
                    </p>
                  </div>
                ))
              ) : (
                <p className="px-4 py-4 text-[14px] leading-snug text-muted-foreground">
                  Nothing in our list fits all of that at once. Try a longer time horizon or a little more risk, or turn the sustainability filter off.
                </p>
              )}
              {why.length > 0 && (
                <div className="border-t px-4 py-3 text-[13px] leading-snug text-muted-foreground">
                  <p className="font-medium">How we narrowed it down</p>
                  <ul className="mt-1 list-disc pl-4">
                    {why.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Group>

            <Group title="Learn the basics first" footer="Neutral sources, not product sales. Both open in a new tab.">
              {LEARN.map((l) => (
                <ExternalCard key={l.href} {...l} />
              ))}
            </Group>
          </>
        )}
        <StickyAction onClick={next}>{investsNow === null ? "Skip investing" : "See my plan"}</StickyAction>
      </main>
    );
  }

  // 5. The plan
  const squeezedPlan = plan.spendMonthly <= 0;
  return (
    <main className={wrap}>
      {top}
      {progress}
      <PageTitle title="Your plan">Three amounts, one for each place your money goes.</PageTitle>
      <Slab>
        <p className="text-[15px] text-white/70">On your spending account, each week</p>
        <p className="num mt-1 font-display text-[56px] leading-none font-semibold tracking-[-0.035em]">{squeezedPlan ? "—" : eur.format(plan.spendWeekly)}</p>
        <p className="mt-4 border-t border-white/10 pt-3 text-[13px] leading-snug text-white/65">
          {squeezedPlan ? "After bills and saving, nothing is left for everyday spending. Loosen a goal or the date." : `That is ${eur.format(plan.spendMonthly)} a month for everyday spending. This is the number on your home screen.`}
        </p>
      </Slab>

      <Group title="Where your money goes each month">
        <Row icon={<IconTile><Wallet /></IconTile>} title="Spending account" subtitle="Everyday spending" value={eur.format(Math.max(0, plan.spendMonthly))} valueSub={`${eur.format(Math.max(0, plan.spendWeekly))}/week`} />
        <Row
          icon={<IconTile><PiggyBank /></IconTile>}
          title="Savings account"
          subtitle={[plan.buffer.monthly > 0 ? "Starter buffer" : "", ...plan.goals.filter((g) => g.monthly > 0).map((g) => g.goal.label)].filter(Boolean).join(", ") || "Nothing to move yet"}
          value={eur.format(plan.savingsMonthly)}
          valueSub="to move"
        />
        <Row
          icon={<IconTile><Sprout /></IconTile>}
          title="Investing"
          subtitle={plan.investMonthly > 0 ? "A budget. You choose where." : plan.investCeiling > 0 ? `Room for up to ${eur.format(plan.investCeiling)} when you are ready` : "Not yet"}
          value={eur.format(plan.investMonthly)}
          valueSub="set aside"
        />
      </Group>

      <Group title="How we got there">
        <Row title="Left after bills" value={eur.format(plan.surplus)} />
        <Row title="Everyday spending kept" subtitle="85% of what you usually spend" value={`−${eur.format(plan.everydayFloor)}`} />
        <Row title="Room for saving and investing" value={eur.format(plan.room)} className="font-semibold" />
        {plan.buffer.monthly > 0 && <Row title="Starter buffer" value={`−${eur.format(plan.buffer.monthly)}`} />}
        {plan.goals.map((g) => (
          <Row key={g.goal.id} title={g.goal.label} value={`−${eur.format(g.monthly)}`} />
        ))}
        <Row title="Sensible investing ceiling" subtitle="Half of what is left" value={eur.format(plan.investCeiling)} />
      </Group>

      {plan.notes.length > 0 && (
        <Group title="Good to know">
          {plan.notes.map((n) => (
            <Row key={n} title={n} />
          ))}
        </Group>
      )}

      <StickyAction onClick={() => setConfirming(true)}>Apply this plan</StickyAction>

      {confirming && (
        <ApproveSheet
          title="You approve this plan"
          points={[
            `${eur.format(Math.max(0, plan.spendWeekly))} a week for spending, which updates the number on your home screen.`,
            plan.savingsMonthly > 0 ? `${eur.format(plan.savingsMonthly)} a month moved to a separate savings account.` : "No savings transfer for now.",
            plan.investMonthly > 0 ? `${eur.format(plan.investMonthly)} a month set aside as an investing budget. You choose where it goes; Solvo doesn't recommend products.` : "No investing amount for now.",
            "Demo: nothing is really transferred. You can change or stop this any time.",
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
            });
            router.push("/");
          }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </main>
  );
}

