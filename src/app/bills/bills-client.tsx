"use client";

import { addTransitionType, startTransition, useEffect, useMemo, useState } from "react";
import { SubScreen } from "@/components/solvo/screen";
import { BillHistory, type PaidBill } from "./bill-history";
import { ArrowRight, Leaf, Cable, Check, FileText, Smartphone, Sparkles, Zap } from "lucide-react";
import {
  BackButton,
  Chip,
  Group,
  IconTile,
  PAGE,
  PageTitle,
  TopBar,
  eur,
  dec2,
  eur2,
  primaryButton,
} from "@/components/solvo/ui";
import { ApproveSheet, DoneView, EditField, OfferOption, ReadFields, SavingSlab, StickyAction } from "./switch-ui";
import { LearnChip } from "@/components/learn/learn-chip";
import type { Reading } from "@/lib/einvoice";
import { useUrlStep } from "@/lib/use-url-step";
import { compare, type ContractTerms, type ElectricityPreference } from "@/lib/offers";
import { SAVED_ELECTRICITY_DB, domainOf, type MarketDb } from "@/lib/market";
import { compareTelecom, telecomTermsFrom } from "@/lib/telecom-offers";
import {
  approveSwitch,
  cacheReading,
  readCachedReadings,
  useCachedReadings,
  useSavingsPlan,
  useSwitches,
  weeklyBoost,
  type BillKey,
  type SwitchRecord,
} from "@/lib/switches";
import { MarketAgentCard, agentHasRun } from "./market-agent-card";
import { PreferencePicker } from "./preference-picker";
import { PhotoUpload } from "./photo-upload";
import { TelecomDetail } from "./telecom-detail";

type InvoiceMeta = { id: string; payment: { date: string; amount: number } | null }; // null = read from a photo
type Loaded = {
  reading: Reading;
  source: "gemini" | "saved";
  model?: string;
  ms: number;
  cached?: boolean;
  fromPhoto?: boolean;
};

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const fmtDate = (iso: string | null) => (iso ? dateFmt.format(new Date(`${iso}T00:00:00Z`)) : "–");

const KIND_LABEL: Record<Reading["kind"], string> = {
  electricity_energy: "Electricity",
  electricity_transmission: "Electricity transmission",
  telecom: "Phone and internet",
  other: "Other bill",
};

const KIND_ICON: Record<Reading["kind"], typeof Zap> = {
  electricity_energy: Zap,
  electricity_transmission: Cable,
  telecom: Smartphone,
  other: FileText,
};

function termsFrom(r: Reading): ContractTerms {
  return {
    annualKwh: r.annualConsumptionKwh ?? (r.consumptionKwh ?? 0) * 12,
    centsPerKwh: r.priceCentsPerKwh ?? 0,
    monthlyFee: r.monthlyFee ?? 0,
    centsAfterEnd: r.priceAfterEndCentsPerKwh,
    monthlyFeeAfterEnd: r.monthlyFeeAfterEnd,
  };
}

export function BillsClient(props: {
  asOf: string;
  invoices: InvoiceMeta[];
  weeklyBudget: number;
  remaining: number;
  history: PaidBill[];
  dentalBill: boolean; // Aino's unpaid dentist e-invoice, part of her demo story only
}) {
  const [fetched, setLoaded] = useState<Record<string, Loaded>>({});
  const stored = useCachedReadings() as Record<string, Loaded>;
  // Readings from this visit win (they carry the reading time); earlier ones come from the device cache.
  const loaded = useMemo(() => {
    const fromCache = Object.fromEntries(Object.entries(stored).map(([id, l]) => [id, { ...l, cached: true }]));
    return { ...fromCache, ...fetched };
  }, [stored, fetched]);
  const [open, setOpenState] = useState<string | null>(null);
  // Opening a contract slides it in like a new screen; going back slides it out. Each opened contract is its own
  // history entry (?bill=id), so the iPhone's swipe back returns to the list instead of leaving Bills.
  const step = useUrlStep("bill", (id, back) =>
    startTransition(() => {
      addTransitionType(back || !id ? "nav-back" : "nav-forward");
      setOpenState(id);
    }),
  );
  const [photos, setPhotos] = useState<InvoiceMeta[]>([]);
  const switches = useSwitches();

  // Each e-invoice is read by Gemini once per device and kept in localStorage; later visits are instant and make
  // no Gemini call. Profile has "Read e-invoices again" for the demo. Saved fallback readings aren't cached, so
  // Gemini gets another try next time.
  useEffect(() => {
    const cached = readCachedReadings();
    for (const inv of props.invoices) {
      if (cached[inv.id]) continue;
      fetch("/api/read-invoice", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: inv.id }),
      })
        .then((r) => r.json())
        .then((d: Loaded) => {
          if (!d.reading) return;
          if (d.source === "gemini") cacheReading(inv.id, d);
          setLoaded((prev) => ({ ...prev, [inv.id]: d }));
        })
        .catch(() => {});
    }
  }, [props.invoices]);

  // Opening a contract starts at the top of the page, like a new screen.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [open]);

  const openInvoice = open ? loaded[open] : undefined;
  const all = [...props.invoices, ...photos];
  const actionable = all.filter((inv) => isActionable(loaded[inv.id], switches));
  const others = all.filter((inv) => !isActionable(loaded[inv.id], switches));

  return (
    <main className={PAGE}>
      <TopBar back={open ? <BackButton onClick={() => step.back(null)} label="Bills" /> : undefined} />

      <SubScreen id={open && openInvoice ? open : "list"}>
        <div className="flex flex-1 flex-col">
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
              <PageTitle title="Your bills">
                {props.invoices.length
                  ? "Solvo read the e-invoices that reached your bank this month. Nothing to photograph or upload."
                  : "No e-invoices from your suppliers have reached your bank yet. When one arrives, Solvo reads it here and compares the contract."}
              </PageTitle>

              {actionable.map((inv) => (
                <FeaturedInvoice key={inv.id} meta={inv} loaded={loaded[inv.id]!} onOpen={() => step.push(inv.id)} />
              ))}

              {others.length > 0 && (
                <Group
                  title={actionable.length ? "Other bills" : "This month"}
                  className={actionable.length ? "mt-7" : "mt-0"}
                >
                  {others.map((inv) => (
                    <InvoiceRow
                      key={inv.id}
                      meta={inv}
                      loaded={loaded[inv.id]}
                      switched={switchedFor(loaded[inv.id], switches)}
                    />
                  ))}
                </Group>
              )}

              <PhotoUpload
                onRead={(d) => {
                  const id = `photo-${photos.length + 1}`;
                  setLoaded((prev) => ({ ...prev, [id]: { ...d, source: "gemini", fromPhoto: true } }));
                  setPhotos((prev) => [...prev, { id, payment: null }]);
                }}
              />

              <BillHistory bills={props.history} asOf={props.asOf} dentalBill={props.dentalBill} />
            </>
          )}
        </div>
      </SubScreen>
    </main>
  );
}

const BILL_KEY: Partial<Record<Reading["kind"], BillKey>> = { electricity_energy: "electricity", telecom: "telecom" };

function switchedFor(l: Loaded | undefined, switches: ReturnType<typeof useSwitches>) {
  const key = l ? BILL_KEY[l.reading.kind] : undefined;
  return key ? switches[key] : undefined;
}

/** A bill Solvo can act on: electricity or phone and internet, switchable, not switched yet. */
function isActionable(l: Loaded | undefined, switches: ReturnType<typeof useSwitches>) {
  return (
    !!l &&
    (l.reading.kind === "electricity_energy" || l.reading.kind === "telecom") &&
    l.reading.switchable &&
    !switchedFor(l, switches)
  );
}

function SourceBadge({ l }: { l: Loaded }) {
  return l.source === "gemini" ? (
    <Chip tone="green">
      <Sparkles className="size-3" aria-hidden />
      {l.fromPhoto ? "Read from your photo" : "Read by Gemini"}
      {l.cached || !l.ms ? "" : ` in ${(l.ms / 1000).toFixed(1)} s`}
    </Chip>
  ) : (
    <Chip>Saved reading, AI offline</Chip>
  );
}

/** The bill Solvo can do something about: shown first, with the saving up front. */
function FeaturedInvoice({ meta, loaded, onOpen }: { meta: InvoiceMeta; loaded: Loaded; onOpen: () => void }) {
  const r = loaded.reading;
  const isElectricity = r.kind === "electricity_energy";
  const saving = isElectricity
    ? compare(termsFrom(r)).recommended.saving
    : compareTelecom(telecomTermsFrom(r)).recommended.saving;
  const Icon = KIND_ICON[r.kind];
  return (
    <section className="rounded-[24px] bg-card p-5 shadow-[0_1px_3px_rgba(15,42,31,0.06)] ring-1 ring-warn/25">
      <div className="flex items-start gap-3">
        <IconTile tone="warn">
          <Icon />
        </IconTile>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[15px] font-semibold">{r.supplier}</p>
            <p className="num text-[15px] font-semibold">{eur2.format(r.monthlyCost)}/mo</p>
          </div>
          <p className="text-[13px] text-muted-foreground">
            {KIND_LABEL[r.kind]}, {r.product}
          </p>
        </div>
      </div>

      {saving > 0 && agentHasRun(isElectricity ? "electricity" : "telecom") && (
        <p className="mt-4 font-display text-[22px] leading-tight font-semibold tracking-[-0.015em]">
          You could save <span className="num text-primary">{eur.format(saving)}</span> a year
        </p>
      )}
      <p className="mt-2 text-[14px] leading-snug text-muted-foreground">{r.summary}</p>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <SourceBadge l={loaded} />
        <Chip>
          {meta.payment
            ? `Paid ${eur2.format(-meta.payment.amount)} on ${fmtDate(meta.payment.date)}`
            : `From your photo, due ${fmtDate(r.dueDate)}`}
        </Chip>
      </div>

      <button type="button" className={`${primaryButton} mt-4`} onClick={onOpen}>
        Compare offers
        <ArrowRight className="size-[18px]" aria-hidden />
      </button>
    </section>
  );
}

function InvoiceRow({ meta, loaded, switched }: { meta: InvoiceMeta; loaded?: Loaded; switched?: SwitchRecord }) {
  if (!loaded) {
    return (
      <div className="flex items-start gap-3 px-4 py-4 [&+&]:border-t" aria-busy>
        <span className="shimmer size-9 shrink-0 rounded-xl" />
        <div className="flex-1">
          <p className="text-[15px] font-medium text-muted-foreground">Reading e-invoice…</p>
          <p className="num mt-0.5 text-[13px] text-muted-foreground">
            {meta.payment
              ? `Payment ${eur2.format(-meta.payment.amount)} on ${fmtDate(meta.payment.date)}`
              : "Your photo"}
          </p>
          <div className="shimmer mt-2.5 h-2.5 w-3/4 rounded-full" />
        </div>
      </div>
    );
  }
  const r = loaded.reading;
  const Icon = KIND_ICON[r.kind];
  return (
    <div className="flex items-start gap-3 px-4 py-4 [&+&]:border-t">
      <IconTile tone="grey">
        <Icon />
      </IconTile>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-[15px] font-medium">{r.supplier}</p>
          <p className="num shrink-0 text-[15px] font-medium">{eur2.format(r.monthlyCost)}/mo</p>
        </div>
        <p className="text-[13px] text-muted-foreground">
          {KIND_LABEL[r.kind]}, {r.product}
        </p>
        <p className="mt-2 text-[14px] leading-snug">{r.summary}</p>
        {r.kind === "electricity_transmission" && (
          <p className="mt-2 text-[13px] leading-snug text-muted-foreground">
            Transmission can&apos;t be switched, but cutting your kWh lowers this bill too.
          </p>
        )}
        {switched && (
          <p className="mt-2.5 flex items-start gap-2 rounded-xl bg-accent px-3 py-2.5 text-[13px] leading-snug text-accent-foreground">
            <Check className="mt-px size-4 shrink-0" strokeWidth={2.75} aria-hidden />
            <span>
              {switched.toProduct === "price match"
                ? `Price-match request sent to ${switched.toSupplier}`
                : `Switching to ${switched.toSupplier} ${switched.toProduct}`}
              {switched.startDate ? ` from ${fmtDate(switched.startDate)}` : ""}. You save about{" "}
              {eur.format(switched.yearlySaving)} a year.
            </span>
          </p>
        )}
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <SourceBadge l={loaded} />
        </div>
      </div>
    </div>
  );
}

function ElectricityDetail(props: { loaded: Loaded; weeklyBudget: number; remaining: number; asOf: string }) {
  const r = props.loaded.reading;
  const [terms, setTerms] = useState<ContractTerms>(() => termsFrom(r));
  const set = (k: keyof ContractTerms) => (v: number | null) =>
    setTerms((t) => ({ ...t, [k]: v ?? (k === "centsAfterEnd" || k === "monthlyFeeAfterEnd" ? null : 0) }));

  const [db, setDb] = useState<MarketDb>(SAVED_ELECTRICITY_DB);
  const [ran, setRan] = useState(() => agentHasRun("electricity")); // offers appear once the agent has run
  const revealOffers = () => {
    setRan(true);
    // Bring the saving into view: it appears at the top of the screen.
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 600);
  };
  const [preference, setPreference] = useState<ElectricityPreference>("fixed");
  const cmp = useMemo(() => compare(terms, db, preference), [terms, db, preference]);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const chosen = cmp.offers.find((o) => o.id === chosenId) ?? cmp.recommended;
  const [stage, setStage] = useState<"compare" | "confirm" | "done">("compare");
  const perWeek = chosen.saving / 52;
  const boost = weeklyBoost(useSwitches(), useSavingsPlan()); // all approved switches, including this one once approved
  const startDate = r.contractEndDate ? nextDay(r.contractEndDate) : null;

  if (stage === "done") {
    return (
      <DoneView
        title="Switch requested"
        body={
          <>
            {chosen.supplier} {chosen.product} starts {fmtDate(startDate)}. {chosen.supplier} cancels your {r.supplier}{" "}
            contract for you, so there&apos;s nothing else to do.
          </>
        }
        remainingBefore={props.remaining + boost - Math.max(0, perWeek)}
        remainingAfter={props.remaining + boost}
        perWeek={Math.max(0, perWeek)}
        footnote={
          <>
            Your weekly budget grows from {eur.format(props.weeklyBudget)} to {eur.format(props.weeklyBudget + boost)},
            because a fixed cost just got smaller. That&apos;s {eur.format(chosen.saving)} a year.
          </>
        }
        steps={[
          { title: "Signed with your bank ID", detail: "You approved the switch in the bank app, so no separate contract to sign." },
          {
            title: `Order sent to ${chosen.supplier}`,
            detail: "Solvo passes the order to the new supplier through a partner interface.",
          },
          {
            title: "Switch registered in Datahub",
            detail: `${chosen.supplier} registers it in Fingrid's Datahub, which ends your ${r.supplier} contract automatically. Takes about 2 weeks${
              startDate ? `; a fixed-term contract switches on its end date, ${fmtDate(startDate)}` : ""
            }.`,
          },
          {
            title: "First new e-invoice checked",
            detail: `When ${chosen.supplier}'s first e-invoice reaches your bank, Solvo checks the price matches the offer.`,
          },
        ]}
        reminder={
          chosen.termMonths && startDate
            ? "Solvo will remind you a month before this contract ends, so it never rolls over to a worse price again."
            : undefined
        }
      />
    );
  }

  return (
    <div className="flex flex-col pb-24">
      <PageTitle title="Your electricity">
        {r.supplier}, {r.product}. Contract ends {fmtDate(r.contractEndDate)}.
      </PageTitle>

      {ran && (
        <SavingSlab
          label="Switching saves you"
          saving={chosen.saving}
          before={{ label: `Do nothing, rolls over ${fmtDate(startDate)}`, yearly: cmp.doNothing }}
          after={{ label: `${chosen.supplier} ${chosen.product}`, yearly: chosen.yearly }}
          footnote={<>That&apos;s +{eur.format(Math.max(0, perWeek))} to your safe-to-spend every week.</>}
        />
      )}

      <ReadFields badge={<SourceBadge l={props.loaded} />}>
        <EditField label="Yearly use" value={terms.annualKwh} unit="kWh" step="100" onChange={set("annualKwh")} />
        <EditField label="Price now" value={terms.centsPerKwh} unit="c/kWh" onChange={set("centsPerKwh")} />
        <EditField label="Base fee now" value={terms.monthlyFee} unit="€/mo" onChange={set("monthlyFee")} />
        <EditField
          label={`Price after ${fmtDate(r.contractEndDate)}`}
          value={terms.centsAfterEnd}
          unit="c/kWh"
          onChange={set("centsAfterEnd")}
        />
        <EditField
          label="Base fee after"
          value={terms.monthlyFeeAfterEnd}
          unit="€/mo"
          onChange={set("monthlyFeeAfterEnd")}
        />
      </ReadFields>
      <LearnChip pack="electricity" className="mt-3 self-start">
        Learn why: fixed or spot price?
      </LearnChip>

      <MarketAgentCard
        db={db}
        onResult={setDb}
        onFinished={revealOffers}
        shortlist={cmp.offers.map((o) => o.id)}
        forYou={
          <>
            For you it only picks the best of your group,{" "}
            <span className="font-medium text-foreground">
              {cmp.segment.label.charAt(0).toLowerCase() + cmp.segment.label.slice(1)}
            </span>
            , and prices them at your own {terms.annualKwh.toLocaleString("fi-FI")} kWh.
          </>
        }
      />

      {ran && (
        <PreferencePicker
          value={preference}
          onChange={(v) => {
            setPreference(v);
            setChosenId(null);
          }}
          options={[
            { value: "cheapest", label: "Lowest cost" },
            { value: "fixed", label: "Fixed price" },
            { value: "renewable", label: "Renewable", icon: <Leaf className="size-4 shrink-0" aria-hidden /> },
          ]}
        />
      )}

      {ran && (
        <Group
          title="Your options for a year"
          aside={`${terms.annualKwh.toLocaleString("fi-FI")} kWh`}
          footer={`Real public prices found by Solvo's market agent, energy only. At your price today, before the contract rolls over, a year would cost ${eur.format(cmp.current)}.`}
        >
          <div role="radiogroup" aria-label="Electricity offers">
            {cmp.offers.map((o) => (
              <OfferOption
                key={o.id}
                chosen={o.id === chosen.id}
                onSelect={() => setChosenId(o.id)}
                title={`${o.supplier} ${o.product}`}
                yearly={o.yearly}
                detail={
                  <>
                    {o.pricing === "spot"
                      ? `Spot, about ${dec2(o.centsPerKwh)} c/kWh (margin ${dec2(o.marginCents ?? 0)})`
                      : `${dec2(o.centsPerKwh)} c/kWh`}
                    {` + ${dec2(o.monthlyFee)} €/mo`}
                    {o.termMonths ? `, fixed ${o.termMonths} months` : ""}
                    {o.note ? `. ${o.note}` : ""}
                    {o.renewable && (
                      <span className="mt-0.5 flex items-center gap-1 font-medium text-primary">
                        <Leaf className="size-3.5" aria-hidden />
                        Renewable electricity
                      </span>
                    )}
                    <span className="mt-0.5 block">
                      Source: {domainOf(o.sourceUrl)}, checked {fmtDate(o.checkedAt)}
                    </span>
                  </>
                }
                pick={o.id === cmp.recommended.id ? cmp.pickReason : undefined}
              />
            ))}
          </div>
        </Group>
      )}


      {ran && (
        <StickyAction onClick={() => setStage("confirm")}>Switch to {chosen.supplier}</StickyAction>
      )}

      {stage === "confirm" && (
        <ApproveSheet
          title="You approve this switch"
          points={[
            `New contract: ${chosen.supplier} ${chosen.product}, from ${fmtDate(startDate)}.`,
            `${chosen.supplier} cancels your ${r.supplier} contract for you.`,
            "No switching fees. You can cancel within 14 days.",
          ]}
          confirmLabel="Approve switch"
          onCancel={() => setStage("compare")}
          onConfirm={() => {
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
        />
      )}
    </div>
  );
}

function nextDay(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
