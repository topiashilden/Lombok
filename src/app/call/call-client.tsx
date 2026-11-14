"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CALL_AUDIO, CALL_SCRIPT, UNPAID } from "@/data/reminders";
import { setBillAction, useBillActions } from "@/lib/switches";

const eur = new Intl.NumberFormat("fi-FI", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const eur2 = new Intl.NumberFormat("fi-FI", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
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

  // "Pay now" on Home skips the call: /call?skip=1
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("skip")) setTimeout(() => setStage("after"), 0);
    return () => stopAll();
  }, []);

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
      <main className="flex min-h-dvh flex-col items-center justify-between bg-emerald-950 px-6 pt-[calc(4rem+env(safe-area-inset-top))] pb-[calc(3rem+env(safe-area-inset-bottom))] text-emerald-50">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className={`flex size-24 items-center justify-center rounded-full bg-emerald-50 ${stage === "ringing" ? "animate-pulse" : ""}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/solvo-logo.png" alt="" className="w-16" />
          </div>
          <p className="text-3xl font-semibold">Solvo</p>
          <p className="text-sm text-emerald-200">
            {stage === "ringing" ? "Your money coach · S-Pankki" : mmss}
          </p>
          <p className="rounded-full bg-emerald-900 px-3 py-1 text-xs text-emerald-200">
            About your dentist bill. Not a collection call.
          </p>
        </div>

        {stage === "talking" && (
          <div className="flex w-full max-w-sm flex-col gap-2 text-sm leading-relaxed text-emerald-100" aria-live="polite">
            {shown.map((l, i) => (
              <p key={i} className={i === shown.length - 1 ? "text-emerald-50" : "text-emerald-300"}>
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
              <span className="flex size-16 animate-bounce items-center justify-center rounded-full bg-emerald-500 text-2xl" aria-hidden>
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
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-sm text-muted-foreground">
          ← Home
        </Link>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/solvo-logo.png" alt="Solvo" className="h-5 w-auto" />
      </header>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Your dentist bill</h1>
        <p className="text-sm text-muted-foreground">
          {UNPAID.supplier} · {UNPAID.what}
        </p>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-muted-foreground">Amount</dt>
          <dd className="text-right font-semibold tabular-nums">{eur2.format(UNPAID.amount)}</dd>
          <dt className="text-muted-foreground">Was due</dt>
          <dd className="text-right">{fmtDate(UNPAID.dueDate)}</dd>
          <dt className="text-muted-foreground">Reference</dt>
          <dd className="text-right tabular-nums">{UNPAID.reference}</dd>
          <dt className="text-muted-foreground">Paid from</dt>
          <dd className="text-right">Set-aside for irregular costs</dd>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          Health costs are in your irregular basket, so paying this doesn&apos;t lower your safe-to-spend this week.
        </p>
      </div>

      {outcome === "paid" ? (
        <div className="flex flex-col gap-3 rounded-xl bg-emerald-950 p-4 text-emerald-50">
          <p className="text-lg font-semibold">Paid. No reminder fee.</p>
          <p className="text-sm text-emerald-200">
            {eur.format(UNPAID.amount)} to {UNPAID.supplier}. Your safe-to-spend this week stays the same.
          </p>
          <Link href="/" className="text-sm underline underline-offset-4">
            Back to home
          </Link>
        </div>
      ) : outcome === "snoozed" ? (
        <div className="flex flex-col gap-3 rounded-xl border p-4">
          <p className="font-medium">OK, Solvo reminds you on Monday morning.</p>
          <p className="text-sm text-muted-foreground">No more calls about this bill. You can pay any time from Home.</p>
          <Link href="/" className="text-sm underline underline-offset-4">
            Back to home
          </Link>
        </div>
      ) : stage === "confirm" ? (
        <div className="flex flex-col gap-3 rounded-xl border border-emerald-700 p-4 text-sm">
          <p className="font-medium">You approve this payment</p>
          <ul className="list-disc pl-5 text-muted-foreground">
            <li>
              {eur2.format(UNPAID.amount)} to {UNPAID.supplier}, reference {UNPAID.reference}.
            </li>
            <li>From your S-Pankki account today.</li>
          </ul>
          <div className="flex gap-2">
            <button
              className="h-11 flex-1 rounded-lg bg-emerald-800 font-medium text-white"
              onClick={() => {
                setBillAction(UNPAID.id, "paid");
                setStage("paid");
              }}
            >
              Approve payment
            </button>
            <button className="h-11 rounded-lg border px-4" onClick={() => setStage("after")}>
              Not now
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <button className="h-11 rounded-lg bg-emerald-800 font-medium text-white" onClick={() => setStage("confirm")}>
            Pay {eur.format(UNPAID.amount)} now
          </button>
          <button
            className="h-11 rounded-lg border font-medium"
            onClick={() => {
              setBillAction(UNPAID.id, "snoozed");
              setStage("snoozed");
            }}
          >
            Remind me on Monday
          </button>
          <Link
            href={`/coach?q=${encodeURIComponent(`I can't pay my ${UNPAID.amount} euro dentist bill right now. What can I do?`)}`}
            className="flex h-11 items-center justify-center rounded-lg border font-medium"
          >
            I can&apos;t pay it right now
          </Link>
          <p className="text-xs text-muted-foreground">
            Solvo is your coach, not a collector. Calls are opt-in, and you can turn them off in settings.
          </p>
        </div>
      )}
    </main>
  );
}
