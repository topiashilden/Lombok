"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Reading } from "@/lib/einvoice";
import { approveSwitch, useSwitches, weeklyBoost } from "@/lib/switches";
import { compareTelecom, TELECOM_OFFERS_UPDATED, type TelecomTerms } from "@/lib/telecom-offers";

const eur = new Intl.NumberFormat("fi-FI", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const eur2 = new Intl.NumberFormat("fi-FI", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const fmtDate = (iso: string) => dateFmt.format(new Date(`${iso}T00:00:00Z`));

// Telecom contracts here are open-ended with one month's notice, so a switch starts on the first day
// of the month after next.
function startDateFrom(asOf: string) {
  const d = new Date(`${asOf}T00:00:00Z`);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 2, 1)).toISOString().slice(0, 10);
}

export function TelecomDetail(props: {
  reading: Reading;
  badge: React.ReactNode;
  weeklyBudget: number;
  remaining: number;
  asOf: string;
}) {
  const r = props.reading;
  const [terms, setTerms] = useState<TelecomTerms>({
    lines: r.mobileLines ?? 1,
    perLine: r.pricePerLine ?? r.monthlyCost,
    homeInternet: r.homeInternetMonthly ?? 0,
  });
  const cmp = useMemo(() => compareTelecom(terms), [terms]);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const chosen = cmp.offers.find((o) => o.id === chosenId) ?? cmp.recommended;
  const [stage, setStage] = useState<"compare" | "confirm" | "done">("compare");
  const switches = useSwitches();
  const startDate = startDateFrom(props.asOf);
  const perWeek = Math.max(0, chosen.saving) / 52;
  const isMatch = chosen.kind === "price_match";

  if (stage === "done") {
    const boost = weeklyBoost(switches);
    return (
      <div className="flex flex-col gap-4">
        <Card className="bg-emerald-950 text-emerald-50 ring-emerald-900">
          <CardHeader>
            <CardDescription className="text-emerald-200">{isMatch ? "Price-match request sent" : "Switch requested"}</CardDescription>
            <CardTitle className="text-2xl">
              {chosen.operator} {isMatch ? "" : chosen.product}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm text-emerald-100">
            {isMatch ? (
              <p>Solvo asked {r.supplier} to lower your price. We&apos;ll tell you their answer. Nothing changes if they say no.</p>
            ) : (
              <p>
                Starts {fmtDate(startDate)}. Your phone numbers move with you, and {chosen.operator} cancels your {r.supplier}{" "}
                contract for you.
              </p>
            )}
            <p>You save about {eur.format(chosen.saving)} a year.</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Safe to spend this week</CardDescription>
            <CardTitle className="flex items-baseline gap-3 text-4xl font-semibold tracking-tight">
              {eur.format(props.remaining + boost)}
              <span className="text-base font-medium text-emerald-700">+{eur.format(boost)}/week</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Your weekly budget is now {eur.format(props.weeklyBudget + boost)}, up from {eur.format(props.weeklyBudget)},
            because your fixed costs got smaller.
          </CardContent>
        </Card>
        <Link href="/" className="text-center text-sm text-muted-foreground underline underline-offset-4">
          Back to home
        </Link>
      </div>
    );
  }

  const field = (label: string, k: keyof TelecomTerms, unit: string, step = "any") => (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1">
        <input
          type="number"
          inputMode="decimal"
          step={step}
          min={0}
          value={terms[k]}
          onChange={(e) => setTerms((t) => ({ ...t, [k]: Math.max(0, Number(e.target.value) || 0) }))}
          className="w-24 rounded-md border bg-background px-2 py-1 text-right tabular-nums"
        />
        <span className="w-12 text-xs text-muted-foreground">{unit}</span>
      </span>
    </label>
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Your phone and internet</h1>
        <p className="text-sm text-muted-foreground">
          {r.supplier}, {r.product}. Valid until further notice, one month&apos;s notice.
        </p>
      </div>

      <Card className="bg-emerald-950 text-emerald-50 ring-emerald-900">
        <CardHeader>
          <CardDescription className="text-emerald-200">{isMatch ? "Asking for a better price saves" : "Switching saves you"}</CardDescription>
          <CardTitle className="text-5xl font-semibold tracking-tight">
            {eur.format(Math.max(0, chosen.saving))}
            <span className="ml-1 text-xl font-medium">/year</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-emerald-200">
          That&apos;s +{eur.format(perWeek)} to your safe-to-spend every week. You pay {eur2.format(cmp.currentMonthly)} a month
          today.
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>What Solvo read from your e-invoice</CardTitle>
          <CardDescription className="flex items-center justify-between gap-2">
            <span>Check it. You can correct anything.</span>
            {props.badge}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {field("Mobile lines", "lines", "lines", "1")}
          {field("Price per line", "perLine", "€/mo")}
          {field("Home internet", "homeInternet", "€/mo")}
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>Your options for a year</CardTitle>
          <CardDescription>For {terms.lines} unlimited-data {terms.lines === 1 ? "line" : "lines"} and home internet. Tap one to choose it.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Do nothing</span>
            <span className="tabular-nums text-red-700">{eur.format(cmp.current)}</span>
          </div>
          {cmp.offers.map((o) => {
            const isChosen = o.id === chosen.id;
            return (
              <button
                key={o.id}
                onClick={() => setChosenId(o.id)}
                className={`flex flex-col gap-0.5 rounded-lg border p-2 text-left ${isChosen ? "border-emerald-700 bg-emerald-50" : ""}`}
              >
                <span className="flex justify-between gap-2 font-medium">
                  <span>
                    {o.operator} {o.kind === "switch" ? o.product : ""}
                    {o.id === cmp.recommended.id && <span className="ml-2 text-xs text-emerald-700">Coach&apos;s pick</span>}
                  </span>
                  <span className="tabular-nums">{eur.format(o.yearly)}</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {o.kind === "price_match" ? `${o.product}. ` : ""}
                  {eur2.format(o.perLine)}/line ({o.lineSpeed})
                  {o.homeInternet != null ? ` + ${o.homeSpeed} ${eur2.format(o.homeInternet)}` : " + your current home internet"}
                  {o.note ? ` · ${o.note}` : ""}
                </span>
              </button>
            );
          })}
          <p className="text-xs text-muted-foreground">
            Demo offer table, updated {fmtDate(TELECOM_OFFERS_UPDATED)}. Operators are fictional.
          </p>
        </CardContent>
      </Card>

      {stage === "compare" ? (
        <Button className="h-11 bg-emerald-800 text-base text-white hover:bg-emerald-900" onClick={() => setStage("confirm")}>
          {isMatch ? `Ask ${r.supplier} for a better price` : `Switch to ${chosen.operator}`}
        </Button>
      ) : (
        <Card size="sm" className="ring-emerald-700">
          <CardHeader>
            <CardTitle>{isMatch ? "You approve this request" : "You approve this switch"}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <ul className="list-disc pl-5 text-muted-foreground">
              {isMatch ? (
                <>
                  <li>Solvo asks {r.supplier} to lower your lines to {eur2.format(chosen.perLine)} a month.</li>
                  <li>Your contract and numbers stay the same.</li>
                </>
              ) : (
                <>
                  <li>
                    New contract: {chosen.operator} {chosen.product}, from {fmtDate(startDate)}.
                  </li>
                  <li>Your phone numbers move with you. {chosen.operator} cancels {r.supplier} for you.</li>
                  <li>No switching fees. You can cancel within 14 days.</li>
                </>
              )}
            </ul>
            <div className="flex gap-2">
              <Button
                className="h-10 flex-1 bg-emerald-800 text-white hover:bg-emerald-900"
                onClick={() => {
                  approveSwitch({
                    bill: "telecom",
                    fromSupplier: r.supplier,
                    toSupplier: chosen.operator,
                    toProduct: isMatch ? "price match" : chosen.product,
                    yearlySaving: Math.max(0, chosen.saving),
                    startDate: isMatch ? null : startDate,
                    approvedAt: new Date().toISOString(),
                  });
                  setStage("done");
                }}
              >
                Approve
              </Button>
              <Button variant="outline" className="h-10" onClick={() => setStage("compare")}>
                Not now
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
