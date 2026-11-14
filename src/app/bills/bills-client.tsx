"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Reading } from "@/lib/einvoice";
import { compare, OFFERS_UPDATED, type ContractTerms } from "@/lib/offers";
import { approveSwitch, useSavingsPlan, useSwitches, weeklyBoost, type BillKey } from "@/lib/switches";
import { PhotoUpload } from "./photo-upload";
import { TelecomDetail } from "./telecom-detail";

type InvoiceMeta = { id: string; payment: { date: string; amount: number } | null }; // null = read from a photo
type Loaded = { reading: Reading; source: "gemini" | "saved"; model?: string; ms: number; cached?: boolean; fromPhoto?: boolean };

const eur = new Intl.NumberFormat("fi-FI", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const eur2 = new Intl.NumberFormat("fi-FI", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const fmtDate = (iso: string | null) => (iso ? dateFmt.format(new Date(`${iso}T00:00:00Z`)) : "–");

const KIND_LABEL: Record<Reading["kind"], string> = {
  electricity_energy: "Electricity",
  electricity_transmission: "Electricity transmission",
  telecom: "Phone and internet",
  other: "Other bill",
};

export function BillsClient(props: {
  asOf: string;
  invoices: InvoiceMeta[];
  weeklyBudget: number;
  remaining: number;
}) {
  const [loaded, setLoaded] = useState<Record<string, Loaded>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [photos, setPhotos] = useState<InvoiceMeta[]>([]);

  useEffect(() => {
    for (const inv of props.invoices) {
      fetch("/api/read-invoice", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: inv.id }) })
        .then((r) => r.json())
        .then((d: Loaded) => setLoaded((prev) => ({ ...prev, [inv.id]: d })))
        .catch(() => {});
    }
  }, [props.invoices]);

  const openInvoice = open ? loaded[open] : undefined;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6">
      <header className="flex items-center justify-between">
        {open ? (
          <button className="text-sm text-muted-foreground" onClick={() => setOpen(null)}>
            ← All bills
          </button>
        ) : (
          <Link href="/" className="text-sm text-muted-foreground">
            ← Home
          </Link>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/solvo-logo.png" alt="Solvo" className="h-5 w-auto" />
      </header>

      {open && openInvoice?.reading.kind === "telecom" ? (
        <TelecomDetail
          reading={openInvoice.reading}
          badge={<SourceBadge l={openInvoice} />}
          weeklyBudget={props.weeklyBudget}
          remaining={props.remaining}
          asOf={props.asOf}
        />
      ) : open && openInvoice ? (
        <ElectricityDetail
          loaded={openInvoice}
          weeklyBudget={props.weeklyBudget}
          remaining={props.remaining}
          asOf={props.asOf}
        />
      ) : (
        <>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Your bills</h1>
            <p className="text-sm text-muted-foreground">
              Solvo read the e-invoices that reached your bank this month. Nothing to photograph or upload.
            </p>
          </div>
          {[...props.invoices, ...photos].map((inv) => (
            <InvoiceCard key={inv.id} meta={inv} loaded={loaded[inv.id]} onOpen={() => setOpen(inv.id)} />
          ))}
          <PhotoUpload
            onRead={(d) => {
              const id = `photo-${photos.length + 1}`;
              setLoaded((prev) => ({ ...prev, [id]: { ...d, source: "gemini", fromPhoto: true } }));
              setPhotos((prev) => [...prev, { id, payment: null }]);
            }}
          />
        </>
      )}
    </main>
  );
}

function SourceBadge({ l }: { l: Loaded }) {
  return (
    <span className="shrink-0 whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
      {l.fromPhoto
        ? `Read from your photo · ${(l.ms / 1000).toFixed(1)} s`
        : l.source === "gemini"
        ? `Read by Gemini${l.cached || !l.ms ? "" : ` · ${(l.ms / 1000).toFixed(1)} s`}`
        : "Saved reading (AI offline)"}
    </span>
  );
}

const BILL_KEY: Partial<Record<Reading["kind"], BillKey>> = { electricity_energy: "electricity", telecom: "telecom" };

function InvoiceCard({ meta, loaded, onOpen }: { meta: InvoiceMeta; loaded?: Loaded; onOpen: () => void }) {
  const switches = useSwitches();
  if (!loaded) {
    return (
      <Card size="sm" className="animate-pulse">
        <CardHeader>
          <CardDescription>Reading e-invoice…</CardDescription>
          <CardTitle className="text-muted-foreground">
            {meta.payment ? `Payment ${eur2.format(-meta.payment.amount)} on ${fmtDate(meta.payment.date)}` : "Your photo"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-3 w-3/4 rounded bg-muted" />
        </CardContent>
      </Card>
    );
  }
  const r = loaded.reading;
  const key = BILL_KEY[r.kind];
  const switched = key ? switches[key] : undefined;
  const actionable = (r.kind === "electricity_energy" || r.kind === "telecom") && r.switchable && !switched;
  return (
    <Card size="sm" className={actionable ? "ring-amber-300 bg-amber-50" : ""}>
      <CardHeader>
        <CardDescription className="flex items-center justify-between gap-2">
          <span>{KIND_LABEL[r.kind]}</span>
          <SourceBadge l={loaded} />
        </CardDescription>
        <CardTitle className="flex items-baseline justify-between gap-2">
          <span>{r.supplier}</span>
          <span className="tabular-nums">{eur2.format(r.monthlyCost)}/mo</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-sm">{r.summary}</p>
        <p className="text-xs text-muted-foreground">
          {r.product} ·{" "}
          {meta.payment
            ? `matched to your payment of ${eur2.format(-meta.payment.amount)} on ${fmtDate(meta.payment.date)}`
            : `from your photo, due ${fmtDate(r.dueDate)}`}
        </p>
        {switched && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            {switched.toProduct === "price match"
              ? `Price-match request sent to ${switched.toSupplier}`
              : `Switching to ${switched.toSupplier} ${switched.toProduct}`}
            {switched.startDate ? ` from ${fmtDate(switched.startDate)}` : ""}. You save about{" "}
            {eur.format(switched.yearlySaving)} a year.
          </p>
        )}
        {actionable && (
          <Button className="mt-1 bg-emerald-800 text-white hover:bg-emerald-900" onClick={onOpen}>
            {r.kind === "telecom" ? "Compare phone and internet offers" : "Compare electricity offers"}
          </Button>
        )}
        {r.kind === "electricity_transmission" && (
          <p className="text-xs text-muted-foreground">
            Coach tip: transmission can&apos;t be switched, but cutting your kWh lowers this bill too.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function NumberField(props: { label: string; value: number | null; unit: string; step?: string; onChange: (v: number | null) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{props.label}</span>
      <span className="flex items-center gap-1">
        <input
          type="number"
          inputMode="decimal"
          step={props.step ?? "any"}
          value={props.value ?? ""}
          onChange={(e) => props.onChange(e.target.value === "" ? null : Number(e.target.value))}
          className="w-24 rounded-md border bg-background px-2 py-1 text-right tabular-nums"
        />
        <span className="w-12 text-xs text-muted-foreground">{props.unit}</span>
      </span>
    </label>
  );
}

function ElectricityDetail(props: { loaded: Loaded; weeklyBudget: number; remaining: number; asOf: string }) {
  const r = props.loaded.reading;
  const [terms, setTerms] = useState<ContractTerms>({
    annualKwh: r.annualConsumptionKwh ?? (r.consumptionKwh ?? 0) * 12,
    centsPerKwh: r.priceCentsPerKwh ?? 0,
    monthlyFee: r.monthlyFee ?? 0,
    centsAfterEnd: r.priceAfterEndCentsPerKwh,
    monthlyFeeAfterEnd: r.monthlyFeeAfterEnd,
  });
  const set = (k: keyof ContractTerms) => (v: number | null) =>
    setTerms((t) => ({ ...t, [k]: v ?? (k === "centsAfterEnd" || k === "monthlyFeeAfterEnd" ? null : 0) }));

  const cmp = useMemo(() => compare(terms), [terms]);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const chosen = cmp.offers.find((o) => o.id === chosenId) ?? cmp.recommended;
  const [stage, setStage] = useState<"compare" | "confirm" | "done">("compare");
  const perWeek = chosen.saving / 52;
  const boost = weeklyBoost(useSwitches(), useSavingsPlan()); // all approved switches, including this one once approved
  const startDate = r.contractEndDate ? nextDay(r.contractEndDate) : null;

  if (stage === "done") {
    return (
      <div className="flex flex-col gap-4">
        <Card className="bg-emerald-950 text-emerald-50 ring-emerald-900">
          <CardHeader>
            <CardDescription className="text-emerald-200">Switch requested</CardDescription>
            <CardTitle className="text-2xl">
              {chosen.supplier} {chosen.product}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm text-emerald-100">
            <p>
              Starts {fmtDate(startDate)}. {chosen.supplier} cancels your {r.supplier} contract for you, so there&apos;s
              nothing else to do.
            </p>
            <p>You save about {eur.format(chosen.saving)} a year.</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Safe to spend this week</CardDescription>
            <CardTitle className="flex items-baseline gap-3 text-4xl font-semibold tracking-tight">
              {eur.format(props.remaining + boost)}
              <span className="text-base font-medium text-emerald-700">+{eur.format(perWeek)}/week</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Your weekly budget grows from {eur.format(props.weeklyBudget)} to {eur.format(props.weeklyBudget + boost)},
            because a fixed cost just got smaller. Fixed costs aren&apos;t fixed.
          </CardContent>
        </Card>
        {chosen.termMonths && startDate && (
          <p className="text-xs text-muted-foreground">
            Solvo will remind you a month before this contract ends, so it never rolls over to a worse price again.
          </p>
        )}
        <Link
          href="/save"
          className="flex h-11 items-center justify-center rounded-lg bg-emerald-800 font-medium text-white hover:bg-emerald-900"
        >
          Save it in a fund instead
        </Link>
        <Link href="/" className="text-center text-sm text-muted-foreground underline underline-offset-4">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Your electricity</h1>
        <p className="text-sm text-muted-foreground">
          {r.supplier}, {r.product}. Contract ends {fmtDate(r.contractEndDate)}.
        </p>
      </div>

      <Card className="bg-emerald-950 text-emerald-50 ring-emerald-900">
        <CardHeader>
          <CardDescription className="text-emerald-200">Switching saves you</CardDescription>
          <CardTitle className="text-5xl font-semibold tracking-tight">
            {eur.format(Math.max(0, chosen.saving))}
            <span className="ml-1 text-xl font-medium">/year</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-emerald-200">
          That&apos;s +{eur.format(Math.max(0, perWeek))} to your safe-to-spend every week, compared with letting the
          contract roll over on {fmtDate(startDate)}.
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>What Solvo read from your e-invoice</CardTitle>
          <CardDescription className="flex items-center justify-between gap-2">
            <span>Check it. You can correct anything.</span>
            <SourceBadge l={props.loaded} />
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <NumberField label="Yearly use" value={terms.annualKwh} unit="kWh" step="100" onChange={set("annualKwh")} />
          <NumberField label="Price now" value={terms.centsPerKwh} unit="c/kWh" onChange={set("centsPerKwh")} />
          <NumberField label="Base fee now" value={terms.monthlyFee} unit="€/mo" onChange={set("monthlyFee")} />
          <NumberField label={`Price after ${fmtDate(r.contractEndDate)}`} value={terms.centsAfterEnd} unit="c/kWh" onChange={set("centsAfterEnd")} />
          <NumberField label="Base fee after" value={terms.monthlyFeeAfterEnd} unit="€/mo" onChange={set("monthlyFeeAfterEnd")} />
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>Your options for a year</CardTitle>
          <CardDescription>At {terms.annualKwh.toLocaleString("fi-FI")} kWh a year. Tap one to choose it.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Do nothing (rolls over {fmtDate(startDate)})</span>
            <span className="tabular-nums text-red-700">{eur.format(cmp.doNothing)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Today&apos;s price, for comparison</span>
            <span className="tabular-nums">{eur.format(cmp.current)}</span>
          </div>
          {cmp.offers.map((o) => {
            const isChosen = o.id === chosen.id;
            return (
              <button
                key={o.id}
                onClick={() => setChosenId(o.id)}
                className={`flex flex-col gap-0.5 rounded-lg border p-2 text-left ${isChosen ? "border-emerald-700 bg-emerald-50" : ""}`}
              >
                <span className="flex justify-between font-medium">
                  <span>
                    {o.supplier} {o.product}
                    {o.id === cmp.recommended.id && <span className="ml-2 text-xs text-emerald-700">Coach&apos;s pick</span>}
                  </span>
                  <span className="tabular-nums">{eur.format(o.yearly)}</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {o.pricing === "spot" ? "Spot, about " : ""}
                  {o.centsPerKwh.toFixed(2)} c/kWh + {o.monthlyFee.toFixed(2)} €/mo
                  {o.termMonths ? ` · fixed ${o.termMonths} months` : ""}
                  {o.note ? ` · ${o.note}` : ""}
                </span>
              </button>
            );
          })}
          <p className="text-xs text-muted-foreground">
            Demo offer table, updated {fmtDate(OFFERS_UPDATED)}. Providers are fictional.
          </p>
        </CardContent>
      </Card>

      {stage === "compare" ? (
        <Button className="h-11 bg-emerald-800 text-base text-white hover:bg-emerald-900" onClick={() => setStage("confirm")}>
          Switch to {chosen.supplier}
        </Button>
      ) : (
        <Card size="sm" className="ring-emerald-700">
          <CardHeader>
            <CardTitle>You approve this switch</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <ul className="list-disc pl-5 text-muted-foreground">
              <li>
                New contract: {chosen.supplier} {chosen.product}, from {fmtDate(startDate)}.
              </li>
              <li>{chosen.supplier} cancels your {r.supplier} contract for you.</li>
              <li>No switching fees. You can cancel within 14 days.</li>
            </ul>
            <div className="flex gap-2">
              <Button className="h-10 flex-1 bg-emerald-800 text-white hover:bg-emerald-900" onClick={() => {
                  approveSwitch({
                    bill: "electricity",
                    fromSupplier: r.supplier,
                    toSupplier: chosen.supplier,
                    toProduct: chosen.product,
                    yearlySaving: Math.max(0, chosen.saving),
                    startDate,
                    approvedAt: new Date().toISOString(),
                  });
                  setStage("done");
                }}
              >
                Approve switch
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

function nextDay(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
