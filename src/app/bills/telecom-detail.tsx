"use client";

import { useMemo, useState } from "react";
import { Group, PageTitle, eur, eur2 } from "@/components/solvo/ui";
import type { Reading } from "@/lib/einvoice";
import { approveSwitch, useSavingsPlan, useSwitches, weeklyBoost } from "@/lib/switches";
import { compareTelecom, telecomTermsFrom, type TelecomTerms } from "@/lib/telecom-offers";
import { SAVED_TELECOM_DB, domainOf, type TelecomDb } from "@/lib/market";
import { MarketAgentCard } from "./market-agent-card";
import { ApproveSheet, DoneView, EditField, OfferOption, ReadFields, SavingSlab, StickyAction } from "./switch-ui";

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
  const [terms, setTerms] = useState<TelecomTerms>(() => telecomTermsFrom(r));
  const [db, setDb] = useState<TelecomDb>(SAVED_TELECOM_DB);
  const cmp = useMemo(() => compareTelecom(terms, db), [terms, db]);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const chosen = cmp.offers.find((o) => o.id === chosenId) ?? cmp.recommended;
  const [stage, setStage] = useState<"compare" | "confirm" | "done">("compare");
  const switches = useSwitches();
  const plan = useSavingsPlan();
  const startDate = startDateFrom(props.asOf);
  const perWeek = Math.max(0, chosen.saving) / 52;
  const isMatch = chosen.kind === "price_match";

  if (stage === "done") {
    const boost = weeklyBoost(switches, plan);
    return (
      <DoneView
        title={isMatch ? "Price-match request sent" : "Switch requested"}
        body={
          isMatch ? (
            <>Solvo asked {r.supplier} to lower your price. We&apos;ll tell you their answer. Nothing changes if they say no.</>
          ) : (
            <>
              {chosen.operator} {chosen.product} starts {fmtDate(startDate)}. Your phone numbers move with you, and{" "}
              {chosen.operator} cancels your {r.supplier} contract for you.
            </>
          )
        }
        remainingBefore={props.remaining + boost - perWeek}
        remainingAfter={props.remaining + boost}
        perWeek={perWeek}
        footnote={
          <>
            Your weekly budget is now {eur.format(props.weeklyBudget + boost)}, up from {eur.format(props.weeklyBudget)},
            because your fixed costs got smaller. That&apos;s {eur.format(Math.max(0, chosen.saving))} a year.
          </>
        }
      />
    );
  }

  const set = (k: keyof TelecomTerms) => (v: number | null) => setTerms((t) => ({ ...t, [k]: Math.max(0, v ?? 0) }));

  return (
    <div className="flex flex-col pb-24">
      <PageTitle title="Your phone and internet">
        {r.supplier}, {r.product}. Valid until further notice, one month&apos;s notice.
      </PageTitle>

      <SavingSlab
        label={isMatch ? "Asking for a better price saves" : "Switching saves you"}
        saving={chosen.saving}
        before={{ label: `Do nothing, ${eur2.format(cmp.currentMonthly)} a month`, yearly: cmp.current }}
        after={{ label: `${chosen.operator}${chosen.kind === "switch" ? ` ${chosen.product}` : ", price match"}`, yearly: chosen.yearly }}
        footnote={<>That&apos;s +{eur.format(perWeek)} to your safe-to-spend every week.</>}
      />

      <ReadFields badge={props.badge}>
        <EditField label="Mobile lines" value={terms.lines} unit="lines" step="1" min={0} onChange={set("lines")} />
        <EditField label="Price per line" value={terms.perLine} unit="€/mo" min={0} onChange={set("perLine")} />
        <EditField label="Home internet" value={terms.homeInternet} unit="€/mo" min={0} onChange={set("homeInternet")} />
      </ReadFields>

      <Group
        title="Your options for a year"
        aside={`${terms.lines} ${terms.lines === 1 ? "line" : "lines"} + internet`}
        footer="Real public prices found by Solvo's market agent. Regular prices after any campaign."
      >
        <div role="radiogroup" aria-label="Phone and internet offers">
          {cmp.offers.map((o) => (
            <OfferOption
              key={o.id}
              chosen={o.id === chosen.id}
              onSelect={() => setChosenId(o.id)}
              title={`${o.operator}${o.kind === "switch" ? ` ${o.product}` : ""}`}
              yearly={o.yearly}
              detail={
                <>
                  {o.kind === "price_match" ? `${o.product}. ` : ""}
                  {eur2.format(o.perLine)}/line ({o.lineSpeed})
                  {o.homeInternet != null ? ` + ${o.homeSpeed} ${eur2.format(o.homeInternet)}` : " + your current home internet"}
                  {o.note ? `. ${o.note}` : ""}
                  {o.sourceUrl && o.checkedAt && (
                    <span className="mt-0.5 block">
                      Source: {domainOf(o.sourceUrl)}, checked {fmtDate(o.checkedAt)}
                    </span>
                  )}
                </>
              }
              pick={
                o.id === cmp.recommended.id
                  ? o.likeForLike
                    ? "Coach's pick: same speed, lower price"
                    : "Coach's pick: fast enough, and you keep the saving"
                  : undefined
              }
            />
          ))}
        </div>
      </Group>

      <MarketAgentCard
        db={db}
        onResult={setDb}
        forYou={
          <>
            For you it compares plans at every speed for your {terms.lines} {terms.lines === 1 ? "line" : "lines"}, and
            tells you when a slower plan is still enough.
          </>
        }
      />

      <StickyAction onClick={() => setStage("confirm")}>
        {isMatch ? `Ask ${r.supplier} for a better price` : `Switch to ${chosen.operator}`}
      </StickyAction>

      {stage === "confirm" && (
        <ApproveSheet
          title={isMatch ? "You approve this request" : "You approve this switch"}
          points={
            isMatch
              ? [`Solvo asks ${r.supplier} to lower your lines to ${eur2.format(chosen.perLine)} a month.`, "Your contract and numbers stay the same."]
              : [
                  `New contract: ${chosen.operator} ${chosen.product}, from ${fmtDate(startDate)}.`,
                  `Your phone numbers move with you. ${chosen.operator} cancels ${r.supplier} for you.`,
                  "No switching fees. You can cancel within 14 days.",
                ]
          }
          confirmLabel={isMatch ? "Send request" : "Approve switch"}
          onCancel={() => setStage("compare")}
          onConfirm={() => {
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
        />
      )}
    </div>
  );
}
