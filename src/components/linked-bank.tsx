"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Landmark, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { ApproveSheet } from "@/app/bills/switch-ui";
import { Sheet } from "@/components/solvo/sheet";
import { Group, IconTile, Row } from "@/components/solvo/ui";
import { plainFormat } from "@/lib/demo-clock";

// Profile > "Connect a bank". A REAL Enable Banking connection with example data: the bank list comes from Enable Banking, the person
// approves at the bank, and Solvo reads accounts and transactions through the same API a production bank would use. The demo points
// it at Enable Banking's sandbox, so the bank is a test bank. Server side: src/lib/linked-bank.ts. Renders nothing unless it is set up.

const day = plainFormat({ day: "numeric", month: "short" });
type Bank = { name: string; country: string; logo?: string };

const NOTICES: Record<string, string> = {
  connected: "Connected. Your bank now shows on Home.",
  declined: "The approval was cancelled, so nothing was connected.",
  failed: "That connection didn't finish. Try again.",
};

async function request(path: string, init?: RequestInit): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
  try {
    const res = await fetch(path, init);
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, data } : { ok: false, error: typeof data.error === "string" ? data.error : `Something went wrong (${res.status}).` };
  } catch {
    return { ok: false, error: "Couldn't reach the app. Try again." };
  }
}

export function LinkedBank({ enabled, linked, notice }: { enabled: boolean; linked: { bank: string; validUntil: string } | null; notice: string | null }) {
  const router = useRouter();
  const [step, setStep] = useState<"closed" | "pick" | "consent">("closed");
  const [banks, setBanks] = useState<Bank[] | null>(null);
  const [choice, setChoice] = useState<Bank | null>(null);
  const [busy, setBusy] = useState<null | "start" | "sync" | "disconnect">(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (step !== "pick" || banks) return;
    void request("/api/banks").then((r) => (r.ok ? setBanks(r.data.banks as Bank[]) : setError(r.error)));
  }, [step, banks]);

  if (!enabled) return null;

  const start = async () => {
    if (!choice) return;
    setStep("closed");
    setBusy("start");
    setError(null);
    const r = await request("/api/banks/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bank: choice.name, country: choice.country }) });
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

  const action = "flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left font-medium text-primary disabled:opacity-50 [&+&]:border-t";
  const message = notice ? NOTICES[notice] : null;

  return (
    <>
      <Group
        title="Connect a bank"
        footer="Demo: the connection is real, through Enable Banking, and the bank is a test bank with example data. No bank account needed."
      >
        {linked ? (
          <>
            <Row
              icon={<IconTile><Landmark /></IconTile>}
              title={`${linked.bank} connected`}
              subtitle="Example data via Enable Banking"
              value={linked.validUntil ? `Until ${day(linked.validUntil.slice(0, 10))}` : undefined}
            />
            <button type="button" className={action} onClick={() => act("sync")} disabled={busy !== null}>
              <IconTile>{busy === "sync" ? <Loader2 className="animate-spin" /> : <RefreshCw />}</IconTile>
              {busy === "sync" ? "Reading…" : "Sync now"}
            </button>
            <button type="button" className={action} onClick={() => act("disconnect")} disabled={busy !== null}>
              <IconTile tone="grey">{busy === "disconnect" ? <Loader2 className="animate-spin" /> : <Trash2 />}</IconTile>
              Disconnect
            </button>
          </>
        ) : (
          <button type="button" className={action} onClick={() => { setError(null); setStep("pick"); }} disabled={busy !== null}>
            <IconTile>{busy === "start" ? <Loader2 className="animate-spin" /> : <Landmark />}</IconTile>
            {busy === "start" ? "Opening your bank…" : "Connect a bank"}
          </button>
        )}
        {(error || message) && (
          <p role={error ? "alert" : "status"} className={`border-t px-4 py-3 text-[13px] leading-snug ${error ? "text-warn" : "text-muted-foreground"}`}>
            {error ?? message}
          </p>
        )}
      </Group>

      {step === "pick" && (
        <Sheet title="Choose your bank" onClose={() => setStep("closed")} hideDone>
          {!banks && !error && (
            <p role="status" className="flex items-center gap-3 py-2 text-[15px]">
              <Loader2 className="size-5 animate-spin" aria-hidden />
              Loading banks…
            </p>
          )}
          {error && !banks && <p role="alert" className="text-[14px] text-warn">{error}</p>}
          {banks && (
            <div className="overflow-hidden rounded-2xl bg-muted/50">
              {banks.map((b) => (
                <button key={`${b.country}-${b.name}`} type="button" onClick={() => { setChoice(b); setStep("consent"); }} className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left [&+&]:border-t">
                  <IconTile><Landmark /></IconTile>
                  <span className="text-[15px] font-medium">{b.name}</span>
                </button>
              ))}
            </div>
          )}
          <p className="mt-3 text-[13px] leading-snug text-muted-foreground">These are Enable Banking&apos;s test banks. In production the list is your real banks.</p>
        </Sheet>
      )}

      {step === "consent" && choice && (
        <ApproveSheet
          title={`Connect ${choice.name}`}
          points={[
            "Solvo reads your accounts, balances and transactions. Read-only: it can't move money.",
            "You approve at the bank. The connection runs through Enable Banking (PSD2).",
            "Demo: a test bank with example data.",
            "Access lasts 30 days. Disconnect here any time.",
          ]}
          confirmLabel={`Continue to ${choice.name}`}
          onConfirm={start}
          onCancel={() => setStep("pick")}
        />
      )}
    </>
  );
}
