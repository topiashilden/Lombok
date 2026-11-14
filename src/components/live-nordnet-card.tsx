import "server-only";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { TrendingUp } from "lucide-react";
import { Group, IconTile, Row, eur } from "@/components/solvo/ui";
import type { NordnetSummary } from "@/lib/nordnet-core";

/**
 * LOCAL ONLY. The owner's own Nordnet accounts, read through Nordnet's API by scripts/nordnet-api.mjs. Shown on Home only in
 * local Nordea mode and only if that script has fetched a summary. The file is gitignored and never exists on Vercel.
 */
export function LiveNordnetCard() {
  if (process.env.VERCEL) return null;
  const file = path.join(process.cwd(), "data/private/nordnet-api/summary.json");
  if (!existsSync(file)) return null;
  const s = JSON.parse(readFileSync(file, "utf8")) as NordnetSummary;
  const market = s.accounts.reduce((sum, a) => sum + a.marketValue, 0);
  const cash = s.accounts.reduce((sum, a) => sum + a.cash, 0);
  const capital = s.accounts.reduce((sum, a) => sum + a.ownCapital, 0);
  return (
    <Group title="Nordnet, live and local only" className="mt-4" footer={`Read from your own Nordnet account on ${s.fetchedAt.slice(0, 10)}. Read-only: Solvo can't trade.`}>
      <Row icon={<IconTile><TrendingUp /></IconTile>} title="Investments" subtitle={`${s.positions.length} positions in ${s.accounts.length} account${s.accounts.length === 1 ? "" : "s"}`} value={eur.format(market)} />
      <Row title="Cash in the accounts" value={eur.format(cash)} />
      <Row title="Your own capital" subtitle="Cash plus investments, minus any loan" value={eur.format(capital)} />
    </Group>
  );
}
