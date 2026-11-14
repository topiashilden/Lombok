"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CALL_AUDIO, CALL_SCRIPT, UNPAID } from "@/data/reminders";
import { ApproveSheet } from "@/app/bills/switch-ui";
import { BackLink, Group, PAGE, PageTitle, Row, Slab, TopBar, eur, eur2, primaryButton, secondaryButton } from "@/components/solvo/ui";
import { setBillAction, useBillActions } from "@/lib/switches";

const dateFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const fmtDate = (iso: string) => dateFmt.format(new Date(`${iso}T00:00:00Z`));

// Transcript lines, revealed in step with the audio (by share of characters spoken).
const LINES = CALL_SCRIPT.match(/[^.!?]+[.!?]+/g)?.map((s) => s.trim()) ?? [CALL_SCRIPT];
const STARTS = (() => {
  const total = LINES.reduce((n, l) => n + l.length, 0);
  let acc = 0;
  return LINES.map((l) => {
    const start = acc / total;
    acc += l.length;
    return start;
  });
})();
const FALLBACK_SECONDS = 30;

type Stage = "ringing" | "talking" | "after" | "confirm" | "paid" | "snoozed";

export function CallClient() {
  const [stage, setStage] = useState<Stage>("ringing");
  const [progress, setProgress] = useState(0); // 0..1 of the call spoken
  const [seconds, setSeconds] = useState(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const done = useBillActions()[UNPAID.id];

  function stopAll() {
    audio.current?.pause();
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    if (timer.current) clearInterval(timer.current);
  }

  useEffect(() => () => stopAll(), []);

  function hangUp() {
    stopAll();
    setStage("after");
  }

  // Fallback when the recording can't play: the phone's own voice reads the same script.
  function speakFallback() {
    const synth = window.speechSynthesis;
    const started = Date.now();
    if (synth) {
      const u = new SpeechSynthesisUtterance(CALL_SCRIPT);
      u.lang = "en-US";
      u.rate = 1;
      u.onend = () => hangUp();
      synth.speak(u);
    }
    timer.current = setInterval(() => {
      const t = (Date.now() - started) / 1000;
      setSeconds(Math.floor(t));
      setProgress(Math.min(1, t / FALLBACK_SECONDS));
      if (!synth && t > FALLBACK_SECONDS) hangUp();
    }, 250);
  }

  function answer() {
    setStage("talking");
    const a = new Audio(CALL_AUDIO);
    audio.current = a;
    a.ontimeupdate = () => {
      setSeconds(Math.floor(a.currentTime));
      if (a.duration) setProgress(a.currentTime / a.duration);
    };
    a.onended = () => hangUp();
    // play() must start inside the tap on iOS, which this is.
    a.play().catch(() => speakFallback());
  }

  const mmss = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const shown = LINES.filter((_, i) => STARTS[i] <= progress + 0.02);

  if (stage === "ringing" || stage === "talking") {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-between bg-slab px-6 pt-[calc(4rem+env(safe-area-inset-top))] pb-[calc(3rem+env(safe-area-inset-bottom))] text-white">
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="mb-4 rounded-full bg-mint px-3 py-1 text-[12px] font-semibold text-slab">
            Demo call. In real use your phone would ring.
          </p>
          <div className={`flex size-24 items-center justify-center rounded-full bg-white ${stage === "ringing" ? "animate-pulse" : ""}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/solvo-logo.png" alt="" className="w-16" />
          </div>
          <p className="text-3xl font-semibold">Solvo</p>
          <p className="text-sm text-white/70">
            {stage === "ringing" ? "Your money coach · S-Pankki" : mmss}
          </p>
          <p className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
            About your dentist bill. Not a collection call.
          </p>
        </div>

        {stage === "talking" && (
          <div className="flex w-full max-w-sm flex-col gap-2 text-sm leading-relaxed text-white/80" aria-live="polite">
            {shown.map((l, i) => (
              <p key={i} className={i === shown.length - 1 ? "text-white" : "text-white/55"}>
                {l}
              </p>
            ))}
          </div>
        )}

        {stage === "ringing" ? (
          <div className="flex w-full max-w-xs justify-between">
            <button onClick={hangUp} className="flex flex-col items-center gap-2 text-sm">
              <span className="flex size-16 items-center justify-center rounded-full bg-red-600 text-2xl" aria-hidden>
                ✕
              </span>
              Decline
            </button>
            <button onClick={answer} className="flex flex-col items-center gap-2 text-sm">
              <span className="flex size-16 animate-bounce items-center justify-center rounded-full bg-mint text-slab text-2xl" aria-hidden>
                📞
              </span>
              Answer
            </button>
          </div>
        ) : (
          <button onClick={hangUp} className="flex flex-col items-center gap-2 text-sm">
            <span className="flex size-16 items-center justify-center rounded-full bg-red-600 text-2xl" aria-hidden>
              ✕
            </span>
            End call
          </button>
        )}
      </main>
    );
  }

  const outcome = done?.action ?? (stage === "paid" ? "paid" : stage === "snoozed" ? "snoozed" : null);

  return (
    <main className={PAGE}>
      <TopBar back={<BackLink href="/" label="Home" />} />
      <PageTitle title="Your dentist bill">
        {UNPAID.supplier}, {UNPAID.what.toLowerCase()}.
      </PageTitle>

      <Group
        footer="Health costs are in your irregular basket, so paying this doesn't lower your safe-to-spend this week."
        className="mt-0"
      >
        <Row title="Amount" value={eur2.format(UNPAID.amount)} />
        <Row title="Was due" value={fmtDate(UNPAID.dueDate)} />
        <Row title="Reference" value={UNPAID.reference} />
        <Row title="Paid from" value="Irregular costs set-aside" />
      </Group>

      {outcome === "paid" ? (
        <Slab className="mt-6">
          <p className="font-display text-[24px] font-semibold tracking-[-0.015em]">Paid. No reminder fee.</p>
          <p className="mt-2 text-[15px] text-white/70">
            {eur.format(UNPAID.amount)} to {UNPAID.supplier}. Your safe-to-spend this week stays the same.
          </p>
          <Link href="/" className="mt-4 inline-flex min-h-11 items-center text-[15px] font-semibold text-mint underline underline-offset-4">
            Back to home
          </Link>
        </Slab>
      ) : outcome === "snoozed" ? (
        <section className="mt-6 rounded-2xl bg-card p-4 shadow-[0_1px_3px_rgba(15,42,31,0.06)]">
          <p className="text-[15px] font-semibold">OK, Solvo reminds you on Monday morning.</p>
          <p className="mt-1 text-[14px] text-muted-foreground">No more calls about this bill. You can pay any time from Home.</p>
          <Link href="/" className={`${secondaryButton} mt-4`}>
            Back to home
          </Link>
        </section>
      ) : (
        <div className="mt-6 flex flex-col gap-2">
          <button className={primaryButton} onClick={() => setStage("confirm")}>
            Pay {eur.format(UNPAID.amount)} now
          </button>
          <button
            className={secondaryButton}
            onClick={() => {
              setBillAction(UNPAID.id, "snoozed");
              setStage("snoozed");
            }}
          >
            Remind me on Monday
          </button>
          <Link
            href={`/coach?q=${encodeURIComponent(`I can't pay my ${UNPAID.amount} euro dentist bill right now. What can I do?`)}`}
            className={secondaryButton}
          >
            I can&apos;t pay it right now
          </Link>
          <p className="mt-2 px-1 text-[13px] leading-snug text-muted-foreground">
            Solvo is your coach, not a collector. Calls are opt-in, and you can turn them off any time.
          </p>
        </div>
      )}

      {stage === "confirm" && (
        <ApproveSheet
          title="You approve this payment"
          points={[
            `${eur2.format(UNPAID.amount)} to ${UNPAID.supplier}, reference ${UNPAID.reference}.`,
            "From your S-Pankki account today.",
          ]}
          confirmLabel="Approve payment"
          onConfirm={() => {
            setBillAction(UNPAID.id, "paid");
            setStage("paid");
          }}
          onCancel={() => setStage("after")}
        />
      )}
    </main>
  );
}
