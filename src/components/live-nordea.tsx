"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Landmark, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { ApproveSheet } from "@/app/bills/switch-ui";
import { Group, IconTile, Row } from "@/components/solvo/ui";
import { plainFormat } from "@/lib/demo-clock";
import type { LiveStatus } from "@/lib/live-nordea";

// LOCAL ONLY. Shown on Profile only when the app runs with SOLVO_LIVE=1 (npm run dev:live). Connects the owner's own Nordea through
// Enable Banking with Nordea ID, entirely inside the app: the person never visits Enable Banking's site. Server side:
// src/lib/live-nordea.ts. The type import above is erased at build time, so no server code reaches the browser.

const day = plainFormat({ day: "numeric", month: "short" });

async function post(path: string): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
  try {
    const res = await fetch(path, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, data } : { ok: false, error: typeof data.error === "string" ? data.error : `Something went wrong (${res.status}).` };
  } catch {
    return { ok: false, error: "Couldn't reach the app. Is it still running?" };
  }
}

export function LiveNordea({ status }: { status: LiveStatus }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "start" | "sync" | "disconnect">(null);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  if (!status.enabled) return null;

  const start = async () => {
    setAsking(false);
    setBusy("start");
    setError(null);
    const r = await post("/api/nordea/start");
    if (r.ok && typeof r.data.url === "string") {
      window.location.assign(r.data.url); // Nordea's own approval page, with Nordea ID
      return;
    }
    setError(r.ok ? "Enable Banking didn't return an approval address." : r.error);
    setBusy(null);
  };
  const sync = async () => {
    setBusy("sync");
    setError(null);
    const r = await post("/api/nordea/sync");
    if (!r.ok) setError(r.error);
    else router.refresh();
    setBusy(null);
  };
  const disconnect = async () => {
    if (!window.confirm("Disconnect Nordea? This ends the consent and deletes the downloaded data from this computer.")) return;
    setBusy("disconnect");
    setError(null);
    const r = await post("/api/nordea/disconnect");
    if (!r.ok) setError(r.error);
    else router.refresh();
    setBusy(null);
  };

  const action = "flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left font-medium text-primary disabled:opacity-50 [&+&]:border-t";

  return (
    <>
      <Group
        title="Your real Nordea"
        footer={
          status.connected
            ? "Live and local only: this data stays on this computer and never goes to the demo, the cloud or the coach. Read-only."
            : "Local only. You approve with Nordea ID; Solvo never sees your codes and can't move money."
        }
      >
        {!status.configured ? (
          <Row
            icon={<IconTile tone="warn"><Landmark /></IconTile>}
            title="Needs setup"
            subtitle="Put ENABLE_APP_ID and ENABLE_KEY_PATH in .env.local, then restart npm run dev:live."
          />
        ) : status.connected ? (
          <>
            <Row
              icon={<IconTile><Landmark /></IconTile>}
              title="Nordea connected"
              subtitle={`${status.accounts} account${status.accounts === 1 ? "" : "s"}, ${status.transactions.toLocaleString("en-GB")} transactions${status.syncedAt ? `, synced ${day(status.syncedAt.slice(0, 10))}` : ""}`}
              value={status.validUntil ? `Until ${day(status.validUntil.slice(0, 10))}` : undefined}
            />
            <button type="button" className={action} onClick={sync} disabled={busy !== null}>
              <IconTile>{busy === "sync" ? <Loader2 className="animate-spin" /> : <RefreshCw />}</IconTile>
              {busy === "sync" ? "Downloading…" : "Sync now"}
            </button>
            <button type="button" className={action} onClick={disconnect} disabled={busy !== null}>
              <IconTile tone="grey">{busy === "disconnect" ? <Loader2 className="animate-spin" /> : <Trash2 />}</IconTile>
              Disconnect and delete
            </button>
          </>
        ) : (
          <button type="button" className={action} onClick={() => setAsking(true)} disabled={busy !== null}>
            <IconTile>{busy === "start" ? <Loader2 className="animate-spin" /> : <Landmark />}</IconTile>
            {busy === "start" ? "Opening Nordea…" : "Connect Nordea"}
          </button>
        )}
        {error && (
          <p role="alert" className="border-t px-4 py-3 text-[13px] leading-snug text-warn">
            {error}
          </p>
        )}
      </Group>

      {asking && (
        <ApproveSheet
          title="Connect your Nordea"
          points={[
            "Solvo reads your accounts, balances and transactions. Read-only: it can't move money.",
            "You approve with Nordea ID at Nordea. You never open Enable Banking's website.",
            "Access lasts 30 days. Disconnect here or in Nordea any time.",
            "Real data: it stays on this computer.",
          ]}
          confirmLabel="Continue to Nordea ID"
          onConfirm={start}
          onCancel={() => setAsking(false)}
        />
      )}
    </>
  );
}
