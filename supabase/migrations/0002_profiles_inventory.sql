-- Department store: profiles, products (inventory) and stock movement.
begin;

create table if not exists public.profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  role               text not null default 'store' check (role = 'store'),
  full_name          text,
  phone              text,
  avatar_url         text,
  city               text,
  is_active          boolean not null default true,
  business_name      text,
  business_reg_no    text,
  business_vat_no    text,
  business_address   text,
  business_phone     text,
  business_logo_path text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists profiles_own on public.profiles;
create policy profiles_own on public.profiles for all
  using (id = auth.uid()) with check (id = auth.uid() and role = 'store');

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- PRODUCTS: the shelf. Owner-scoped like every other finance table.
-- ---------------------------------------------------------------------
create table if not exists public.products (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users(id),
  name           text not null,
  sku            text,
  barcode        text,
  category       text,
  unit           text not null default 'pcs',
  price          numeric not null default 0 check (price >= 0),
  purchase_price numeric check (purchase_price is null or purchase_price >= 0),
  stock_level    numeric not null default 0,
  reorder_level  numeric not null default 0,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index if not exists products_owner_name_idx on public.products (owner_id, lower(btrim(name)));
create unique index if not exists products_owner_barcode_idx on public.products (owner_id, barcode) where barcode is not null and barcode <> '';

alter table public.products enable row level security;
drop policy if exists products_owner on public.products;
create policy products_owner on public.products for all
  using (owner_id = public.finance_current_owner())
  with check (owner_id = public.finance_current_owner());

drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products
  for each row execute function public.finance_touch_updated_at();
drop trigger if exists products_stamp_owner on public.products;
create trigger products_stamp_owner before insert on public.products
  for each row execute function public.finance_stamp_owner();

-- ---------------------------------------------------------------------
-- STOCK MOVEMENT. A Sale takes items off the shelf, a Purchase puts them
-- on. Items are matched to products by name (a bill line is a typed or
-- picked name, not a foreign key). Names with no product are ignored.
-- Update = reverse the OLD bill, apply the NEW one, so edits and deletes
-- always leave stock consistent and re-running is safe.
-- ---------------------------------------------------------------------
create or replace function public.apply_bill_stock(p_owner uuid, p_type public.business_transaction_type, p_items jsonb, p_sign int)
returns void language plpgsql as $$
declare it jsonb; delta numeric;
begin
  if p_type not in ('sale', 'purchase') then return; end if;
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    delta := coalesce((it ->> 'qty')::numeric, 0) * p_sign * case when p_type = 'sale' then -1 else 1 end;
    if delta <> 0 then
      update public.products
         set stock_level = stock_level + delta
       where owner_id = p_owner
         and lower(btrim(name)) = lower(btrim(it ->> 'description'));
    end if;
  end loop;
end $$;

create or replace function public.business_transactions_stock()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.apply_bill_stock(old.owner_id, old.type, old.items, -1);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.apply_bill_stock(new.owner_id, new.type, new.items, 1);
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists business_transactions_stock_trg on public.business_transactions;
create trigger business_transactions_stock_trg
  after insert or update of items, type or delete on public.business_transactions
  for each row execute function public.business_transactions_stock();

commit;
