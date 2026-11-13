import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BASKET_LABELS, MAIN_CUSTOMER, type Basket } from "@/lib/demo";

const eur = new Intl.NumberFormat("fi-FI", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export default function Home() {
  const c = MAIN_CUSTOMER;
  const baskets = [1, 2, 3] as Basket[];
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Solvo</h1>
        <p className="text-sm text-muted-foreground">Fixed costs aren&apos;t fixed.</p>
      </header>

      <p className="text-sm text-muted-foreground">
        Demo customer {c.id}, age {c.age}, postcode {c.postalCode}. Last 12 months to {c.asOf}.
      </p>

      {baskets.map((b) => (
        <Card key={b}>
          <CardHeader>
            <CardDescription>Basket {b}</CardDescription>
            <CardTitle>{BASKET_LABELS[b].title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{eur.format(c.summary.basketYear[b])}</p>
            <p className="text-sm text-muted-foreground">
              {BASKET_LABELS[b].blurb} · {eur.format(c.summary.basketYear[b] / 12)} / month
            </p>
          </CardContent>
        </Card>
      ))}
    </main>
  );
}
