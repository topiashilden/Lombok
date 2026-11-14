"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Landmark, Loader2, Plus, TrendingUp, X } from "lucide-react";
import { ApproveSheet } from "@/app/bills/switch-ui";
import { Sheet } from "@/components/solvo/sheet";
import { Group, IconTile } from "@/components/solvo/ui";
import { BANK_INFO, writeBanksCookie, type BankId, type View } from "@/lib/banks";

// Other banks: opt-in, never assumed. Nothing shows here unless the person adds a bank. DEMO: adding a bank is simulated and
// brings example data (src/lib/second-bank.ts). The real connection needs the person's own bank approval and works only for the
// account owner while the bank API is in restricted mode.

type Step = "closed" | "pick" | "consent" | "waiting";

export function OtherBanks({ banks, view, compact = false }: { banks: BankId[]; view: View; compact?: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("closed");
  const [choice, setChoice] = useState<BankId>("nordea");

  const save = (next: BankId[]) => {
    writeBanksCookie(next, view);
    router.refresh();
  };
  const connect = (bank: BankId) => {
    setStep("waiting");
    window.setTimeout(() => {
      save([...new Set([...banks, bank])]);
      setStep("closed");
    }, 1600);
  };
  const open = (b: BankId) => {
    setChoice(b);
    setStep("consent");
  };
  const available = (Object.keys(BANK_INFO) as BankId[]).filter((b) => !banks.includes(b));

  return (
    <>
      <Group
        title="Other banks"
        footer={
          compact
            ? "Optional. Solvo works on its own; another bank adds to the picture. Demo: simulated, with example data."
            : "Optional. Solvo works on its own; another bank adds to the picture. Demo: connecting is simulated and uses example data. You can remove a bank any time."
        }
      >
        {banks.map((b) => (
          <div key={b} className="flex min-h-14 items-center gap-3 py-2 pr-2 pl-4 [&+&]:border-t">
            <IconTile>{BANK_INFO[b].kind === "bank" ? <Landmark /> : <TrendingUp />}</IconTile>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] leading-snug font-medium">{BANK_INFO[b].name}</div>
              <div className="mt-0.5 flex items-center gap-1 text-[13px] text-muted-foreground">
                <Check className="size-3.5 text-primary" aria-hidden />
                Connected, example data
              </div>
            </div>
            <button
              type="button"
              aria-label={`Remove ${BANK_INFO[b].name}`}
              onClick={() => save(banks.filter((x) => x !== b))}
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        ))}
        {available.length > 0 && (
          <button type="button" onClick={() => setStep("pick")} className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left font-medium text-primary [&+&]:border-t">
            <IconTile>
              <Plus />
            </IconTile>
            Add another bank
          </button>
        )}
      </Group>

      {step === "pick" && (
        <Sheet title="Add a bank" onClose={() => setStep("closed")} hideDone>
          <div className="overflow-hidden rounded-2xl bg-muted/50">
            {available.map((b) => (
              <button key={b} type="button" onClick={() => open(b)} className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left [&+&]:border-t">
                <IconTile>{BANK_INFO[b].kind === "bank" ? <Landmark /> : <TrendingUp />}</IconTile>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium">{BANK_INFO[b].name}</span>
                  <span className="block text-[13px] leading-snug text-muted-foreground">{BANK_INFO[b].blurb}</span>
                </span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-[13px] leading-snug text-muted-foreground">More banks come through PSD2 in production. Your own bank is always listed first.</p>
        </Sheet>
      )}

      {step === "consent" && choice === "nordea" && (
        <ApproveSheet
          title="Connect Nordea"
          points={[
            "Solvo reads your accounts, balances and transactions. Read-only: it can't move money.",
            "You approve with Nordea ID at Nordea. Solvo never sees your codes.",
            "Access lasts 90 days. Remove it here or in Nordea any time.",
            "Demo: simulated, with example data.",
          ]}
          confirmLabel="Continue to Nordea ID"
          onConfirm={() => connect("nordea")}
          onCancel={() => setStep("closed")}
        />
      )}
      {step === "consent" && choice === "nordnet" && (
        <ApproveSheet
          title="Add Nordnet"
          points={[
            "Nordnet has no open banking for investment accounts, so you share an export of your holdings.",
            "Solvo reads the file and shows your investments next to S-Pankki's. It can't trade.",
            "Demo: uses an example export.",
          ]}
          confirmLabel="Use example export"
          onConfirm={() => connect("nordnet")}
          onCancel={() => setStep("closed")}
        />
      )}
      {step === "waiting" && (
        <Sheet title={choice === "nordea" ? "Nordea ID" : "Reading the export"} onClose={() => {}} hideDone>
          <div className="flex items-center gap-3 py-2 text-[15px]" role="status">
            <Loader2 className="size-5 animate-spin" aria-hidden />
            {choice === "nordea" ? "Waiting for your approval in Nordea ID… (demo: approved automatically)" : "Reading your holdings…"}
          </div>
        </Sheet>
      )}
    </>
  );
}
