"use client";

// Profile's "Money skills" row: the learning packs, which ones are finished, and a light streak.
import Link from "next/link";
import { Check, ChevronRight, GraduationCap } from "lucide-react";
import { Group, IconTile } from "@/components/solvo/ui";
import { learnStreak, useLearnProgress } from "@/lib/learn-store";
import { PACK_IDS, PACK_META as packs } from "@/lib/learn";

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

export function MoneySkills() {
  const p = useLearnProgress();
  const count = PACK_IDS.filter((id) => p.done[id]).length;
  const streak = learnStreak(p);
  return (
    <Group
      title="Money skills"
      aside={`${count} of ${packs.length} done${streak > 1 ? ` · ${streak}-day streak` : ""}`}
      footer="Short packs in the chat, worked out with your own numbers. Solvo explains how things work; it doesn't give investment advice."
    >
      <div className="flex gap-1 px-4 pt-3.5" aria-hidden>
        {packs.map((k) => (
          <span key={k.id} className={`h-1.5 flex-1 rounded-full ${p.done[k.id] ? "bg-primary" : "bg-muted"}`} />
        ))}
      </div>
      {packs.map((k) => {
        const done = p.done[k.id];
        return (
          <Link
            key={k.id}
            href={`/coach?learn=${k.id}`}
            transitionTypes={["nav-forward"]}
            className="flex min-h-14 items-center gap-3 px-4 py-3 active:bg-muted [&+&]:border-t"
          >
            <IconTile tone={done ? "green" : "grey"}>{done ? <Check /> : <GraduationCap />}</IconTile>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] leading-snug font-medium">{k.title}</span>
              <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
                {done
                  ? `Finished ${dateFmt.format(new Date(done.at))}${done.quizRight ? ", quiz right first time" : ""}`
                  : `${k.minutes} min, quiz and your own numbers`}
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        );
      })}
    </Group>
  );
}
