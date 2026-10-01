# Store Books

Inventory, billing and finance for a department store. Split out of Jageer Nepal:
same UI/UX, same money rules (bills are debts, payments are money, Day Book, two
ledgers, statement import), but its **own Supabase project and its own books**.
Nothing here reads or writes Jageer's database.

## Setup
1. Create a new Supabase project. Copy `.env.example` to `.env`, fill in URL / anon key / DB URL.
2. Run `supabase/migrations/0001_finance.sql`, then `0002_profiles_inventory.sql`
   (SQL editor or psql). Then the smoke test at the bottom of 0001 (see `finance-port/00_STEP_BY_STEP.md` 1.4-1.5).
3. `npm install`, then `npm run web` (or `npm run android`).
4. Register in the app, fill Store Details (profile), add bank accounts, add products.

## What differs from Jageer
- One role (`store`), one portal `app/(store)/`.
- `products` is the store's own shelf (0002); Sale/Purchase bills move stock by a DB trigger
  (matched by item name, case-insensitive).
- Removed: service requests, technicians, marketplace/wholesale, admin, client app, Fonepay, AI chat.
- Kept: bill scan + voice entry hooks (need the `scan-bill` / `voice-command` edge functions deployed and their API keys).

Money rules and formulas: `finance-port/FINANCE-SPEC.md`.
