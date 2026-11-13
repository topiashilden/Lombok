# Lombok — Junction 2026 hackathon project

## Goal
[One sentence: what it does and for whom]
Deadline: Sunday. A working demo beats clean code.

## Stack
- Next.js (App Router, TypeScript), Tailwind, shadcn/ui
- Supabase (Postgres) for data. No auth: use a hardcoded demo user.
- Deployed on Vercel from `main`

## Data (S-Pankki challenge dataset, provisional pick)
Cloned from https://github.com/hackjunction/Junction-2026-S-pankki into `data/s-pankki/` (gitignored, never commit it).
- `tx_junction_transactions.csv`: ~346 MB via Git LFS (`customer_id`, `bank_account_id`, `tx_date`, `tx_timestamp`, `category`, `tx_amount_eur`, `balance_after_eur`, `transaction_type`, `merchant_id`, `mcc_code`). Downloaded and checksum-verified. 3.63M rows, 5,100 customers, 2024-10-01 to 2026-09-30, 515 merchants, 36 MCC codes (~78% of rows have one). Categories: Groceries, Restaurants, Transportation, Utilities, Entertainment, Health, Salary, Home & Tech, Housing, Lifestyle, Travel, Invest Deposit, Other Income, Salary Sweep, Invest Withdraw. Debits are negative `tx_amount_eur`. If the file ever starts with `version https://git-lfs`, it is only the pointer again.
- `tx_customers_junction.csv`: 5,100 customers (`customer_id`, `customer_postal_code`, `customer_age`)
- `mtg_*.csv`: mortgage application history and outcomes (not needed for the coach)
- CSVs start with a UTF-8 BOM: read with `utf-8-sig`.
- Load a seeded subset into Supabase for the demo; don't query the CSV at runtime.

## Rules
- Keep `main` deployable. Small commits, clear messages.
- Work on short-lived branches, one feature each.
- Seed realistic demo data instead of building admin or CRUD screens.
- Don't add dependencies or refactor unless asked.
- Secrets go in `.env.local`, never committed.

## Who owns what
- Topias: [e.g. data, API, AI logic]
- [Teammate]: [e.g. UI and demo flow]
