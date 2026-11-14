"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Group, Row } from "@/components/solvo/ui";
import { MoneyBadge, SignedAmount } from "@/components/solvo/money-badge";
import { useCustomEvents } from "@/lib/calendar-store";
import { useOnboarding } from "@/lib/onboarding-store";
import { upcomingEvents, type Item } from "@/lib/schedule";

const dayLabel = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** On Home, always: the next money in and out, with a way into the full calendar. Not part of onboarding. */
export function UpcomingCard({ items, asOf }: { items: Item[]; asOf: string }) {
  // The dates the person confirmed in onboarding win over the guesses; their own added dates are always included.
  const confirmed = useOnboarding().items;
  const custom = useCustomEvents();
  const events = upcomingEvents(confirmed ?? items, custom, asOf, 21, 4);

  return (
    <Group
      title="Coming up"
      className="mt-4"
      aside={
        <Link href="/calendar" className="flex min-h-11 items-center gap-0.5 font-medium text-primary">
          Calendar
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      }
    >
      {events.length ? (
        events.map((e) => (
          <Row
            key={e.id + e.date}
            icon={<MoneyBadge kind={e.kind} />}
            title={e.label}
            subtitle={e.date === asOf ? "Today" : dayLabel.format(new Date(`${e.date}T00:00:00Z`))}
            value={<SignedAmount kind={e.kind} value={e.amount} />}
          />
        ))
      ) : (
        <p className="px-4 py-4 text-[14px] text-muted-foreground">Nothing expected in the next three weeks. Open the calendar to add a date.</p>
      )}
    </Group>
  );
}
