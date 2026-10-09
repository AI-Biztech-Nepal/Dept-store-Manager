-- Let a Sale or Purchase be saved with no amount yet (rates left blank).
--
-- business_transactions.amount was `check (amount > 0)`. A bill entered with
-- quantities but no rates has an amount of 0: it should still be recorded (and
-- move stock), with the amount filled in later by editing it. An Expense still
-- has to be more than zero.
--
-- The ledger triggers already cope: they only book a debt when amount > 0 and
-- otherwise remove the bill's ledger entry, so a zero bill books nothing.
-- Additive and safe to run more than once.
begin;

do $$
declare
  c record;
begin
  -- Drop whatever check on this table says "amount > 0" (its name is
  -- Postgres's default, but don't rely on that). Postgres stores the rule as
  -- CHECK ((amount > (0)::numeric)); \m keeps discount_amount out of it.
  for c in
    select conname
      from pg_constraint
     where conrelid = 'public.business_transactions'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ~* '\mamount\s*>\s*\(0\)'
  loop
    execute format('alter table public.business_transactions drop constraint %I', c.conname);
  end loop;
end
$$;

alter table public.business_transactions
  drop constraint if exists business_transactions_amount_check;
alter table public.business_transactions
  add constraint business_transactions_amount_check
  check (amount >= 0 and (type <> 'expense' or amount > 0));

commit;
