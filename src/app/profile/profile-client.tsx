"use client";

import {
  Bell,
  Check,
  FileText,
  PhoneCall,
  PiggyBank,
  ShieldCheck,
  Target,
} from "lucide-react";
import {
  Chip,
  Group,
  IconTile,
  PAGE,
  Row,
  TopBar,
  eur,
  secondaryButton,
} from "@/components/solvo/ui";
import { UNPAID } from "@/data/reminders";
import {
  resetDemo,
  useBillActions,
  useSavingsPlan,
  useSwitches,
} from "@/lib/switches";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
});

export function ProfileClient(props: {
  name: string;
  id: string;
  age: number;
  postalCode: string;
  savingsGoal: number;
}) {
  const switches = Object.values(useSwitches()).filter((s) => !!s);
  const plan = useSavingsPlan();
  const bills = useBillActions();
  const paid = bills[UNPAID.id]?.action === "paid";
  const anything =
    switches.length > 0 || !!plan || Object.keys(bills).length > 0;
  const initials = props.name
    .split(" ")
    .map((w) => w[0])
    .join("");

  return (
    <main className={PAGE}>
      <TopBar />
      <section className="mt-4 flex items-center gap-4">
        <span className="flex size-16 items-center justify-center rounded-full bg-slab font-display text-[22px] font-semibold text-mint">
          {initials}
        </span>
        <div>
          <h1 className="font-display text-[26px] leading-tight font-semibold tracking-[-0.02em]">
            {props.name}
          </h1>
          <p className="text-[15px] text-muted-foreground">
            {props.age} years, {props.postalCode} Espoo
          </p>
        </div>
      </section>

      <Group
        title="What you've approved"
        footer="Solvo never switches, pays or saves without your tap."
      >
        {!anything && (
          <Row
            icon={
              <IconTile tone="grey">
                <ShieldCheck />
              </IconTile>
            }
            title="Nothing yet"
            subtitle="Switches, payments and savings plans you approve show up here."
          />
        )}
        {switches.map((s) => (
          <Row
            key={s.bill}
            icon={
              <IconTile>
                <Check />
              </IconTile>
            }
            title={`${s.fromSupplier} → ${s.toSupplier}`}
            subtitle={s.startDate ? `Switch approved, starts ${dateFmt.format(new Date(s.startDate))}` : "Switch approved"}
            value={`−${eur.format(s.yearlySaving)}`}
            valueSub="a year"
          />
        ))}
        {plan && (
          <Row
            icon={
              <IconTile>
                <PiggyBank />
              </IconTile>
            }
            title={plan.fundName}
            subtitle={`Monthly savings plan, on the ${plan.dayOfMonth}nd`}
            value={eur.format(plan.monthly)}
            valueSub="a month"
          />
        )}
        {paid && (
          <Row
            icon={
              <IconTile>
                <Check />
              </IconTile>
            }
            title={`Paid ${UNPAID.supplier}`}
            subtitle="From your set-aside for irregular costs"
            value={eur.format(UNPAID.amount)}
          />
        )}
      </Group>

      <Group title="Solvo settings">
        <Row
          icon={
            <IconTile>
              <FileText />
            </IconTile>
          }
          title="Read my e-invoices"
          subtitle="Find each contract and what it costs"
          value="On"
        />
        <Row
          icon={
            <IconTile>
              <PhoneCall />
            </IconTile>
          }
          title="Call me before a bill is late"
          subtitle="A short voice call, never a collection call"
          value="On"
        />
        <Row
          icon={
            <IconTile>
              <Bell />
            </IconTile>
          }
          title="Contract end dates"
          subtitle="Remind me 30 days before a contract ends"
          value="On"
        />
        <Row
          icon={
            <IconTile>
              <Target />
            </IconTile>
          }
          title="Savings goal"
          subtitle="Kept out of your weekly budget"
          value={eur.format(props.savingsGoal)}
          valueSub="a month"
        />
      </Group>

      <Group
        title="Your data"
        footer="Solvo works on the e-invoices and payments that already reach your bank. Nothing is sent to suppliers until you approve a switch."
      >
        <Row
          title="Data in this demo"
          subtitle="S-Pankki's synthetic Junction 2026 dataset"
          value={<Chip>{props.id}</Chip>}
        />
      </Group>

      {anything && (
        <button
          type="button"
          onClick={resetDemo}
          className={`${secondaryButton} mt-7`}
        >
          Reset demo
        </button>
      )}
    </main>
  );
}
