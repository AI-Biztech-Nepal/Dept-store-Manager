-- Party types: lets the store say what kind of party each person in its Ledger is
-- (Customer, Vendor, Employee, or any type it adds itself). The list belongs to each
-- owner (rename, add, delete as they like), so it is a table of its own rather than a
-- fixed enum; the app fills in the three starter types the first time it is opened.
--
-- A party's type is only a label - it does not move anything between the customer and
-- vendor ledgers. Deleting a type leaves its parties untyped.
-- Additive only. Safe to run more than once.
begin;

create table if not exists public.party_types (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id),
  name        text not null,
  created_at  timestamptz not null default now()
);

-- Plain (owner_id, name) so the app can upsert the starter types by column names
-- (PostgREST's on_conflict cannot reference an expression index).
create unique index if not exists party_types_owner_name_idx
  on public.party_types (owner_id, name);

alter table public.party_types enable row level security;

drop policy if exists party_types_all_owner on public.party_types;
create policy party_types_all_owner on public.party_types
  for all using (owner_id = public.finance_current_owner())
  with check (owner_id = public.finance_current_owner());

drop policy if exists party_types_admin_all on public.party_types;
create policy party_types_admin_all on public.party_types
  for all using (public.finance_is_admin()) with check (public.finance_is_admin());

-- Fills owner_id in on insert when the app leaves it out. Only where 0001 created that function.
do $$
begin
  if to_regprocedure('public.finance_stamp_owner()') is not null then
    drop trigger if exists party_types_stamp_owner on public.party_types;
    create trigger party_types_stamp_owner before insert on public.party_types
      for each row execute function public.finance_stamp_owner();
  end if;
end
$$;

alter table public.customers
  add column if not exists party_type_id uuid references public.party_types(id) on delete set null;

create index if not exists customers_party_type_idx on public.customers (party_type_id);

commit;
