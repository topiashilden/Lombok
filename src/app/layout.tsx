import type { ReactNode } from "react";
import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { Bricolage_Grotesque, Geist_Mono, Instrument_Sans } from "next/font/google";
import "./globals.css";
import { ClockConfig } from "@/components/clock-config";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { TabBar } from "@/components/tab-bar";
import { DATASET_END, configureDemoClock } from "@/lib/demo-clock";
import { getSource } from "@/lib/source";

// Display: Bricolage Grotesque for the big money figures and page titles. Body: Instrument Sans.
const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
});

const body = Instrument_Sans({
  variable: "--font-body",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Solvo",
  description: "Fixed costs aren't fixed.",
  applicationName: "Solvo",
  // iPhone "Add to Home Screen": opens full-screen with no Safari bars.
  appleWebApp: { capable: true, title: "Solvo", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  // Next emits only the newer mobile-web-app-capable; older iOS versions read Apple's own tag.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Draw under the notch and home bar; pages pad with pt-safe / pb-safe.
  viewportFit: "cover",
  themeColor: "#f2f4f1",
  // Android Chrome: resize the layout when the keyboard opens. iOS Safari ignores this.
  interactiveWidget: "resizes-content",
};

// Reads the real date per request (never frozen at deploy time) and turns the demo clock on, so every screen shows today's real
// date. Real bank data (local Nordea mode) is already in real time, so the shift is off there. See src/lib/demo-clock.ts.
async function DemoClock({ children }: { children: ReactNode }) {
  await connection();
  const end = getSource().local ? null : DATASET_END;
  configureDemoClock(end);
  return (
    <>
      <ClockConfig end={end} />
      {children}
    </>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-dvh">
        {/* Phone-width column. On a laptop it sits centred so judges still see the phone layout. */}
        <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-background md:shadow-2xl md:shadow-black/10">
          <Suspense fallback={null}>
            <DemoClock>{children}</DemoClock>
          </Suspense>
          <TabBar />
          <PullToRefresh />
        </div>
      </body>
    </html>
  );
}
