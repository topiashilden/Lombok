"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Landmark, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { Group, IconTile, Row } from "@/components/solvo/ui";
import { request } from "@/lib/client-request";
import { plainFormat } from "@/lib/demo-clock";
import type { LiveStatus } from "@/lib/live-nordea";

// LOCAL ONLY. The owner's own Nordea, once connected (npm run dev:live): status, Sync now and Disconnect. CONNECTING happens in the
// "Add a bank" picker (src/components/other-banks.tsx, first entry), so the demo shows one flow for every bank. Server side:
// src/lib/live-nordea.ts. The type import above is erased at build time, so no server code reaches the browser.

const day = plainFormat({ day: "numeric", month: "short" });

export function LiveNordea({ status }: { status: LiveStatus }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "sync" | "disconnect">(null);
  const [error, setError] = useState<string | null>(null);

  // Off, or ready to connect (the picker offers it): nothing to show here. Not set up: say what is missing. Connected: manage it.
  if (!status.enabled || (status.configured && !status.connected)) return null;

  const run = async (kind: "sync" | "disconnect") => {
    if (kind === "disconnect" && !window.confirm("Disconnect Nordea? This ends the consent and deletes the downloaded data from this computer.")) return;
    setBusy(kind);
    setError(null);
    const r = await request(`/api/nordea/${kind}`, { method: "POST" });
    if (!r.ok) setError(r.error);
    else router.refresh();
    setBusy(null);
  };

  const action = "flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left font-medium text-primary disabled:opacity-50 [&+&]:border-t";

  return (
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
      ) : (
        <>
          <Row
            icon={<IconTile><Landmark /></IconTile>}
            title="Nordea connected"
            subtitle={`${status.accounts} account${status.accounts === 1 ? "" : "s"}, ${status.transactions.toLocaleString("en-GB")} transactions${status.syncedAt ? `, synced ${day(status.syncedAt.slice(0, 10))}` : ""}`}
            value={status.validUntil ? `Until ${day(status.validUntil.slice(0, 10))}` : undefined}
          />
          <button type="button" className={action} onClick={() => run("sync")} disabled={busy !== null}>
            <IconTile>{busy === "sync" ? <Loader2 className="animate-spin" /> : <RefreshCw />}</IconTile>
            {busy === "sync" ? "Downloading…" : "Sync now"}
          </button>
          <button type="button" className={action} onClick={() => run("disconnect")} disabled={busy !== null}>
            <IconTile tone="grey">{busy === "disconnect" ? <Loader2 className="animate-spin" /> : <Trash2 />}</IconTile>
            Disconnect and delete
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="border-t px-4 py-3 text-[13px] leading-snug text-warn">
          {error}
        </p>
      )}
    </Group>
  );
}
