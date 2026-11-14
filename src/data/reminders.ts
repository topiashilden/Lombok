// An unpaid e-invoice for the demo customer, and how Solvo escalates before it becomes a problem:
// notification, then a reminder on the due day, then a friendly voice call (opt-in) a few days later.
// Solvo is a coach, not a collector: it never charges fees and the user approves every payment.
// All names and ids are fictional.

export type UnpaidBill = {
  id: string;
  supplier: string;
  what: string;
  amount: number; // EUR
  dueDate: string; // YYYY-MM-DD
  basket: 1 | 2 | 3; // which budget it comes from
  reference: string;
  iban: string;
};

export const UNPAID: UnpaidBill = {
  id: "dentist-2026-09",
  supplier: "Hymy Hammasklinikka Oy",
  what: "Dental check-up and filling, 9 Sept",
  amount: 148,
  dueDate: "2026-09-25",
  basket: 2,
  reference: "RF18 0000 2026 0914 8",
  iban: "FI00 0000 0000 0000 00",
};

export type EscalationStep = {
  date: string;
  channel: "notification" | "reminder" | "call";
  title: string;
  text: string;
};

export const ESCALATION: EscalationStep[] = [
  {
    date: "2026-09-22",
    channel: "notification",
    title: "Bill due Friday",
    text: "Hymy Hammasklinikka, €148. Tap to pay or schedule it.",
  },
  {
    date: "2026-09-25",
    channel: "reminder",
    title: "Due today",
    text: "Your dentist bill is due today. Paying now keeps it simple.",
  },
  {
    date: "2026-09-30",
    channel: "call",
    title: "Solvo calls you",
    text: "Still open after 5 days. A short, friendly call before a reminder fee is added. You turned calls on.",
  },
];

// Pre-generated with ElevenLabs (voice "Emily", eleven_v4) from this script.
export const CALL_AUDIO = "/audio/solvo-call-en.mp3";
export const CALL_SCRIPT =
  "Hi Aino, it's Solvo, your money coach from S-Pankki. Don't worry, this isn't a collection call. Your dentist bill from Hymy Hammasklinikka, €148, was due last Friday and it's still open. If it's paid by Monday, you won't get a reminder fee. And good news: it comes out of the money you've set aside for irregular costs, so your €338 safe to spend this week stays exactly the same. Want me to get the payment ready? You'll approve it in the app, as always. Talk soon!";
