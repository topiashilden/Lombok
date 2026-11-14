"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Check, Landmark, Loader2, Plus, RefreshCw, Search, Trash2, TrendingUp, X } from "lucide-react";
import { ApproveSheet } from "@/app/bills/switch-ui";
import { Sheet } from "@/components/solvo/sheet";
import { Group, IconTile } from "@/components/solvo/ui";
import {
  BANK_INFO,
  FALLBACK_BANKS,
  PLATFORMS,
  PLATFORM_HOW,
  readBankNameCookie,
  readPlatformCookie,
  writeBankNameCookie,
  writeBanksCookie,
  writePlatformCookie,
  type BankId,
  type Platform,
  type View,
} from "@/lib/banks";
import { postJson, request } from "@/lib/client-request";
import { plainFormat } from "@/lib/demo-clock";
import type { LiveStatus } from "@/lib/live-nordea";

// Other banks: opt-in, never assumed. The picker lists every bank Enable Banking offers, per country, with search, plus the person's
// own Nordea on this computer and the investing platforms.
//  - With the demo bank connection set up (src/lib/linked-bank.ts): picking a bank is a REAL Enable Banking connection with
//    example data (their sandbox test banks). Read on Home in its own card.
//  - Without it: the list is Finland's banks and connecting is simulated with example data (src/lib/second-bank.ts).
//  - Local only, when real Nordea is set up (src/lib/live-nordea.ts): the person's own Nordea is the first entry.
//  - Investing platforms are not part of PSD2, so they are always simulated here, and each says how a real connection would work.

type Bank = { name: string; country: string };
type Choice = { kind: "bank"; name: string; country: string } | { kind: "platform"; name: Platform } | { kind: "live" };
type Step = "closed" | "pick" | "consent" | "waiting";
export type SandboxProps = { enabled: boolean; linked: { bank: string; validUntil: string } | null; notice: string | null };

const COUNTRIES = ["FI", "SE", "NO", "DK", "EE", "DE", "NL", "FR"];
const day = plainFormat({ day: "numeric", month: "short" });
const NOTICES: Record<string, string> = {
  connected: "Connected. Your bank now shows on Home.",
  declined: "The approval was cancelled, so nothing was connected.",
  failed: "That connection didn't finish. Try again.",
};

// The chosen platform and simulated bank name live in cookies. Read them without a flash: the default on the server, the choice in the browser.
const cookieEvent = "solvo-cookie";
const subscribeCookie = (cb: () => void) => {
  window.addEventListener(cookieEvent, cb);
  return () => window.removeEventListener(cookieEvent, cb);
};
const usePlatform = () => useSyncExternalStore(subscribeCookie, readPlatformCookie, (): Platform => "Nordnet");
const useBankName = () => useSyncExternalStore(subscribeCookie, readBankNameCookie, () => "Nordea");

const row = "flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left [&+&]:border-t";
const action = `${row} font-medium text-primary disabled:opacity-50`;

export function OtherBanks({
  banks,
  view,
  compact = false,
  title = "Other banks",
  sandbox = { enabled: false, linked: null, notice: null },
  live,
}: {
  banks: BankId[];
  view: View;
  compact?: boolean;
  title?: string;
  sandbox?: SandboxProps;
  live?: LiveStatus;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("closed");
  const [choice, setChoice] = useState<Choice | null>(null);
  const [country, setCountry] = useState("FI");
  const [query, setQuery] = useState("");
  const [lists, setLists] = useState<Record<string, Bank[] | { error: string }>>({});
  const [busy, setBusy] = useState<null | "start" | "sync" | "disconnect">(null);
  const [error, setError] = useState<string | null>(null);
  const platform = usePlatform();
  const bankName = useBankName();

  const wantsList = step === "pick" && sandbox.enabled && !lists[country];
  useEffect(() => {
    if (!wantsList) return;
    let live = true;
    void request(`/api/banks?country=${country}`).then((r) => {
      if (live) setLists((l) => ({ ...l, [country]: r.ok ? (r.data.banks as Bank[]) : { error: r.error } }));
    });
    return () => {
      live = false;
    };
  }, [wantsList, country]);

  const save = (next: BankId[]) => {
    writeBanksCookie(next, view);
    router.refresh();
  };
  const simulate = (bank: BankId) => {
    setStep("waiting");
    window.setTimeout(() => {
      save([...new Set([...banks, bank])]);
      setStep("closed");
    }, 1600);
  };
  const go = async (path: string, body?: unknown) => {
    setStep("closed");
    setBusy("start");
    setError(null);
    const r = await postJson(path, body);
    if (r.ok && typeof r.data.url === "string") {
      window.location.assign(r.data.url); // the bank's own approval page
      return;
    }
    setError(r.ok ? "The bank didn't return an approval address." : r.error);
    setBusy(null);
  };
  const act = async (kind: "sync" | "disconnect") => {
    setBusy(kind);
    setError(null);
    const r = await request(`/api/banks/${kind}`, { method: "POST" });
    if (!r.ok) setError(r.error);
    else router.refresh();
    setBusy(null);
  };
  const confirm = () => {
    if (!choice) return;
    if (choice.kind === "live") return void go("/api/nordea/start");
    if (choice.kind === "platform") {
      writePlatformCookie(choice.name);
      window.dispatchEvent(new Event(cookieEvent));
      return simulate("nordnet");
    }
    if (sandbox.enabled) return void go("/api/banks/start", { bank: choice.name, country: choice.country });
    writeBankNameCookie(choice.name);
    window.dispatchEvent(new Event(cookieEvent));
    simulate("nordea");
  };

  const liveReady = !!live && live.enabled && live.configured && !live.connected;
  const list = sandbox.enabled ? lists[country] : FALLBACK_BANKS.map((name): Bank => ({ name, country: "FI" }));
  const shown = Array.isArray(list) ? list.filter((b) => b.name.toLowerCase().includes(query.trim().toLowerCase())) : [];
  const message = sandbox.notice ? NOTICES[sandbox.notice] : null;

  const footer = sandbox.enabled
    ? "Optional. Banks connect for real through Enable Banking; the demo uses its test banks with example data. Investing platforms are simulated."
    : compact
      ? "Optional. Solvo works on its own; another bank adds to the picture. Demo: simulated, with example data."
      : "Optional. Solvo works on its own; another bank adds to the picture. Demo: connecting is simulated and uses example data. You can remove a bank any time.";

  const consent = (() => {
    if (!choice) return null;
    if (choice.kind === "live")
      return {
        title: "Connect your Nordea",
        points: [
          "Solvo reads your accounts, balances and transactions. Read-only: it can't move money.",
          "You approve with Nordea ID at Nordea. You never open Enable Banking's website.",
          "Access lasts 30 days. Disconnect on Profile or in Nordea any time.",
          "Real data: it stays on this computer.",
        ],
        label: "Continue to Nordea ID",
      };
    if (choice.kind === "platform")
      return {
        title: `Add ${choice.name}`,
        points: [PLATFORM_HOW[choice.name], "Solvo shows what you hold there next to your S-Pankki funds. It can't trade.", "Demo: shows example holdings."],
        label: "Use example holdings",
      };
    return {
      title: `Connect ${choice.name}`,
      points: sandbox.enabled
        ? [
            "Solvo reads your accounts, balances and transactions. Read-only: it can't move money.",
            "You approve at the bank. The connection runs through Enable Banking (PSD2).",
            "Demo: a test bank with example data.",
            "Access lasts 30 days. Disconnect here any time.",
          ]
        : [
            "Solvo reads your accounts, balances and transactions. Read-only: it can't move money.",
            "You approve at your bank, with its own ID. Solvo never sees your codes.",
            "Access lasts 90 days. Remove it here or at your bank any time.",
            "Demo: simulated, with example data.",
          ],
      label: `Continue to ${choice.name}`,
    };
  })();

  return (
    <>
      <Group title={title} footer={footer}>
        {banks.map((b) => {
          const name = b === "nordnet" ? platform : bankName;
          return (
            <div key={b} className="flex min-h-14 items-center gap-3 py-2 pr-2 pl-4 [&+&]:border-t">
              <IconTile>{BANK_INFO[b].kind === "bank" ? <Landmark /> : <TrendingUp />}</IconTile>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] leading-snug font-medium">{name}</div>
                <div className="mt-0.5 flex items-center gap-1 text-[13px] text-muted-foreground">
                  <Check className="size-3.5 text-primary" aria-hidden />
                  Connected, example data
                </div>
              </div>
              <button type="button" aria-label={`Remove ${name}`} onClick={() => save(banks.filter((x) => x !== b))} className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-muted">
                <X className="size-4" aria-hidden />
              </button>
            </div>
          );
        })}
        {sandbox.linked && (
          <>
            <div className={`${row} justify-between`}>
              <IconTile><Landmark /></IconTile>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] leading-snug font-medium">{sandbox.linked.bank} connected</div>
                <div className="mt-0.5 text-[13px] text-muted-foreground">Example data via Enable Banking</div>
              </div>
              {sandbox.linked.validUntil && <span className="num text-[13px] text-muted-foreground">Until {day(sandbox.linked.validUntil.slice(0, 10))}</span>}
            </div>
            <button type="button" className={action} onClick={() => act("sync")} disabled={busy !== null}>
              <IconTile>{busy === "sync" ? <Loader2 className="animate-spin" /> : <RefreshCw />}</IconTile>
              {busy === "sync" ? "Reading…" : "Sync now"}
            </button>
            <button type="button" className={action} onClick={() => act("disconnect")} disabled={busy !== null}>
              <IconTile tone="grey">{busy === "disconnect" ? <Loader2 className="animate-spin" /> : <Trash2 />}</IconTile>
              Disconnect
            </button>
          </>
        )}
        <button type="button" onClick={() => { setError(null); setQuery(""); setStep("pick"); }} disabled={busy !== null} className={action}>
          <IconTile>{busy === "start" ? <Loader2 className="animate-spin" /> : <Plus />}</IconTile>
          {busy === "start" ? "Opening your bank…" : "Add another bank"}
        </button>
        {(error || message) && (
          <p role={error ? "alert" : "status"} className={`border-t px-4 py-3 text-[13px] leading-snug ${error ? "text-warn" : "text-muted-foreground"}`}>
            {error ?? message}
          </p>
        )}
      </Group>

      {step === "pick" && (
        <Sheet title="Add a bank" onClose={() => setStep("closed")} hideDone>
          {liveReady && (
            <>
              <h3 className="mb-2 text-[13px] font-medium text-muted-foreground">Your own account</h3>
              <div className="mb-5 overflow-hidden rounded-2xl bg-muted/50">
                <button type="button" onClick={() => { setChoice({ kind: "live" }); setStep("consent"); }} className={row}>
                  <IconTile><Landmark /></IconTile>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium">Nordea, your real account</span>
                    <span className="block text-[13px] leading-snug text-muted-foreground">Real data, only you, on this computer</span>
                  </span>
                </button>
              </div>
            </>
          )}

          <h3 className="mb-2 text-[13px] font-medium text-muted-foreground">Banks</h3>
          {sandbox.enabled && (
            <div className="mb-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Country">
              {COUNTRIES.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={country === c} onClick={() => setCountry(c)} className={`h-9 min-w-11 rounded-full px-3 text-[14px] font-medium ${country === c ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  {c}
                </button>
              ))}
            </div>
          )}
          <label className="relative mb-2 block">
            <span className="sr-only">Search banks</span>
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search banks" className="h-11 w-full rounded-xl bg-muted/50 pr-3 pl-10 text-[16px] outline-none" />
          </label>
          <div className="max-h-[34dvh] overflow-y-auto overscroll-contain rounded-2xl bg-muted/50">
            {sandbox.enabled && !list && (
              <p role="status" className="flex items-center gap-3 px-4 py-4 text-[15px]">
                <Loader2 className="size-5 animate-spin" aria-hidden />
                Loading banks…
              </p>
            )}
            {list && !Array.isArray(list) && <p role="alert" className="px-4 py-4 text-[14px] text-warn">{list.error}</p>}
            {Array.isArray(list) && shown.length === 0 && <p className="px-4 py-4 text-[14px] text-muted-foreground">No bank matches.</p>}
            {shown.map((b) => (
              <button key={`${b.country}-${b.name}`} type="button" onClick={() => { setChoice({ kind: "bank", name: b.name, country: b.country }); setStep("consent"); }} className={row}>
                <IconTile><Landmark /></IconTile>
                <span className="text-[15px] font-medium">{b.name}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[13px] leading-snug text-muted-foreground">
            {sandbox.enabled ? "These are Enable Banking's test banks. In production the list is your real banks." : "Finland's banks on Enable Banking. Demo: connecting is simulated."}
          </p>

          <h3 className="mt-5 mb-2 text-[13px] font-medium text-muted-foreground">Investing platform</h3>
          <div className="overflow-hidden rounded-2xl bg-muted/50">
            {PLATFORMS.map((p) => (
              <button key={p} type="button" onClick={() => { setChoice({ kind: "platform", name: p }); setStep("consent"); }} className={row}>
                <IconTile><TrendingUp /></IconTile>
                <span className="text-[15px] font-medium">{p}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[13px] leading-snug text-muted-foreground">Investing platforms aren&apos;t part of open banking. Demo: example holdings.</p>
        </Sheet>
      )}

      {step === "consent" && consent && (
        <ApproveSheet title={consent.title} points={consent.points} confirmLabel={consent.label} onConfirm={confirm} onCancel={() => setStep("pick")} />
      )}

      {step === "waiting" && (
        <Sheet title={choice?.kind === "platform" ? `Reading ${choice.name}` : "Waiting for your bank"} onClose={() => {}} hideDone>
          <div className="flex items-center gap-3 py-2 text-[15px]" role="status">
            <Loader2 className="size-5 animate-spin" aria-hidden />
            {choice?.kind === "platform" ? "Reading your holdings… (demo: example data)" : "Waiting for your approval… (demo: approved automatically)"}
          </div>
        </Sheet>
      )}
    </>
  );
}
