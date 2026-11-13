# Lombok — Junction 2026 hackathon project

## Goal
A mobile-first money coach for S-Pankki customers that doesn't just show where the money went, it **cuts fixed costs**: the user photographs a bill, the AI extracts supplier, price, base fee, consumption and contract end date, shows how much they overpay, and simulates switching the contract with the user's approval. Challenge: S-Pankki "Personal Economic Trainer" (Junction 2026). Full plan, demo script, risks and schedule: `PLAN.md` (in Finnish; it is the source of truth for scope).

Deadline: draft submission Fri 13.11. 23:59, FINAL Sun 15.11. 10:00, live peer review Sun 10:30–13:00. A working demo beats clean code.

## Demo in one line
Three baskets (1 fixed and regular, 2 fixed and irregular, 3 everyday leakage) and one number, "how much can I safely spend this week?". Photograph an electricity bill → AI reads it → compare → overpay ~€240/yr → one-tap approved switch → safe-to-spend goes up. Coach chat answers questions like "how much did I spend on taxis?" from the real S-Pankki data.

## Scope (from PLAN.md)
- Electricity first. Phone and internet only if time remains.
- Switching is simulated. The pitch explains how a real switch would work (new supplier cancels the old contract).
- No insurance comparison (needs insurance-agent registration). Insurance appears only in the spend basket.
- No native app: a web app that works well in a mobile browser.
- Every extracted bill field is shown to the user and editable. Always keep a tested sample bill for the demo.
- The user approves every switch; the AI never acts alone.
- Competition rules: all code written at the event, MIT licence, synthetic or challenge data only, no existing company.

## Stack
- Next.js (App Router, TypeScript), Tailwind, shadcn/ui. Mobile-first layout.
- Gemini API for bill reading (image → structured fields) and the coach chat. Key in `.env.local`.
- No auth: hardcoded demo customer. No database planned: 1–3 demo customers preprocessed from the S-Pankki data into static JSON under the app. Add Supabase only if asked.
- Electricity spot price: a free API (porssisahko.net or ENTSO-E). Supplier prices: a hand-maintained table first, Context.dev later (optional bonus). ElevenLabs voice is an optional wow-factor.
- Deployed on Vercel from `main`

## Data (S-Pankki challenge dataset)
Cloned from https://github.com/hackjunction/Junction-2026-S-pankki into `data/s-pankki/` (gitignored, never commit it).
- `tx_junction_transactions.csv`: ~346 MB via Git LFS (`customer_id`, `bank_account_id`, `tx_date`, `tx_timestamp`, `category`, `tx_amount_eur`, `balance_after_eur`, `transaction_type`, `merchant_id`, `mcc_code`). Downloaded and checksum-verified. 3.63M rows, 5,100 customers, 2024-10-01 to 2026-09-30, 515 merchants, 36 MCC codes (~78% of rows have one). Categories: Groceries, Restaurants, Transportation, Utilities, Entertainment, Health, Salary, Home & Tech, Housing, Lifestyle, Travel, Invest Deposit, Other Income, Salary Sweep, Invest Withdraw. Debits are negative `tx_amount_eur`. If the file ever starts with `version https://git-lfs`, it is only the pointer again.
- `tx_customers_junction.csv`: 5,100 customers (`customer_id`, `customer_postal_code`, `customer_age`)
- `mtg_*.csv`: mortgage application history and outcomes (not needed for the coach)
- CSVs start with a UTF-8 BOM: read with `utf-8-sig`.
- Preprocess 1–3 demo customers into static JSON for the app; don't read the CSV at runtime.
- Key fact the plan builds on: Utilities payments (342,728 rows, 4,922 customers) average ~€2,000/yr per customer (median ~€1,900) and have no `merchant_id` or `mcc_code`, so the bank can't tell what the contract is.
- Demo persona suggestion (not decided): ~35-year-old from Espoo with high bills and lots of restaurant spending.

## Rules
- Keep `main` deployable. Small commits, clear messages.
- Work on short-lived branches, one feature each.
- Seed realistic demo data instead of building admin or CRUD screens.
- Don't add dependencies or refactor unless asked.
- Secrets go in `.env.local`, never committed.

## Who owns what
- Pietu: product and pitch (story, deck, presenting the demo).
- Topias: validation and users (10–15 interviews or bills from other teams, real savings numbers for the pitch, Junction forms).
- Claude: code, data processing and text drafts.

## Open questions (team to decide)
1. Product name (working name: Lombok).
2. Demo persona.
3. Saturday wow-factor: voice (ElevenLabs) or real supplier prices (Context.dev).
