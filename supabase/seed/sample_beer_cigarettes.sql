-- Sample data: 10 Nepali beers / hard drinks and 5 cigarette brands, bought on ONE purchase
-- bill from ONE vendor. Dummy names and prices, for trying the app out.
--
-- How to run: Supabase dashboard -> SQL Editor -> New query -> paste this whole file,
-- change v_email below to the email you sign in to the app with, then Run.
--
-- It goes through the same rules as a bill typed into the app:
--   * the 15 items are added to Inventory with 0 in stock;
--   * the purchase bill then adds the bought quantity to each item's stock (by name);
--   * the bill books its total as payable to the vendor on the vendor ledger.
-- Safe to run twice: items, vendor and bill that already exist are left alone.
-- To undo it, see the commented block at the bottom.

do $$
declare
  v_email       text := 'your-login-email@example.com';   -- <- CHANGE THIS
  v_vendor_name text := 'Himal Beverage & Tobacco Traders (Sample)';
  v_bill_no     text := 'SAMPLE-001';
  v_owner       uuid;
  v_vendor      uuid;
  v_items       jsonb;
  v_total       numeric;
begin
  select id into v_owner from auth.users where lower(email) = lower(btrim(v_email));
  if v_owner is null then
    raise exception 'No account with the email "%". Change v_email at the top of this script.', v_email;
  end if;

  -- The single vendor everything is bought from.
  select id into v_vendor from public.customers
   where owner_id = v_owner and lower(btrim(name)) = lower(v_vendor_name);
  if v_vendor is null then
    insert into public.customers (owner_id, name, address)
    values (v_owner, v_vendor_name, 'Kathmandu')
    returning id into v_vendor;
  end if;

  -- n = order on the bill; price = selling price, cost = what the vendor charges, qty = bought.
  create temporary table _sample_items (
    n int, name text, category text, unit text, price numeric, cost numeric, reorder numeric, qty numeric
  ) on commit drop;

  insert into _sample_items (n, name, category, unit, price, cost, reorder, qty) values
    ( 1, 'Gorkha Lager 650ml',          'Beer',       'bottle', 330,  280,  6, 24),
    ( 2, 'Tuborg Gold 650ml',           'Beer',       'bottle', 340,  290,  6, 24),
    ( 3, 'Carlsberg 650ml',             'Beer',       'bottle', 360,  300,  6, 24),
    ( 4, 'Nepal Ice Strong 650ml',      'Beer',       'bottle', 320,  270,  6, 24),
    ( 5, 'Everest Beer 650ml',          'Beer',       'bottle', 310,  260,  6, 24),
    ( 6, 'Khukri Rum 750ml',            'Hard Drink', 'bottle', 1450, 1250, 3, 12),
    ( 7, 'Khukri Spiced Rum 750ml',     'Hard Drink', 'bottle', 1600, 1400, 3, 12),
    ( 8, 'Old Durbar Whisky 750ml',     'Hard Drink', 'bottle', 2600, 2300, 3, 12),
    ( 9, 'Signature Whisky 750ml',      'Hard Drink', 'bottle', 2250, 1950, 3, 12),
    (10, 'Ruslan Vodka 750ml',          'Hard Drink', 'bottle', 1350, 1150, 3, 12),
    (11, 'Surya Red Cigarettes (20s)',  'Cigarettes', 'pack',   270,  240, 10, 50),
    (12, 'Khukuri Cigarettes (20s)',    'Cigarettes', 'pack',   240,  210, 10, 50),
    (13, 'Shikhar Cigarettes (20s)',    'Cigarettes', 'pack',   220,  190, 10, 50),
    (14, 'Yak Cigarettes (20s)',        'Cigarettes', 'pack',   180,  150, 10, 50),
    (15, 'Deurali Cigarettes (20s)',    'Cigarettes', 'pack',   200,  170, 10, 50);

  -- Inventory first, with nothing on the shelf: the purchase below is what stocks it.
  insert into public.products (owner_id, name, category, unit, price, purchase_price, stock_level, reorder_level)
  select v_owner, s.name, s.category, s.unit, s.price, s.cost, 0, s.reorder
    from _sample_items s
  on conflict (owner_id, lower(btrim(name))) do nothing;

  if exists (select 1 from public.business_transactions
              where owner_id = v_owner and type = 'purchase' and bill_no = v_bill_no) then
    raise notice 'Purchase bill % already exists - no second bill added.', v_bill_no;
  else
    select jsonb_agg(jsonb_build_object('description', s.name, 'qty', s.qty, 'rate', s.cost, 'amount', s.qty * s.cost)
                     order by s.n),
           sum(s.qty * s.cost)
      into v_items, v_total
      from _sample_items s;

    insert into public.business_transactions
      (owner_id, type, amount, party_name, customer_id, note, bill_no, bill_date,
       items, discount_amount, vat_amount, payment_mode, bank_account_id)
    values
      (v_owner, 'purchase', v_total, v_vendor_name, v_vendor, 'Sample stock purchase', v_bill_no, current_date,
       v_items, 0, 0, 'cash', null);

    raise notice 'Added 15 items and purchase bill % from "%" for NPR % (payable on the vendor ledger).',
      v_bill_no, v_vendor_name, v_total;
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- To remove everything this script added (same v_email as above). Select the
-- block and run it on its own. Deleting the bill takes the stock back off and
-- clears the vendor payable by itself.
--
-- do $$
-- declare
--   v_email text := 'your-login-email@example.com';   -- <- CHANGE THIS
--   v_owner uuid;
-- begin
--   select id into v_owner from auth.users where lower(email) = lower(btrim(v_email));
--   delete from public.business_transactions where owner_id = v_owner and bill_no = 'SAMPLE-001';
--   delete from public.products  where owner_id = v_owner and category in ('Beer', 'Hard Drink', 'Cigarettes');
--   delete from public.customers where owner_id = v_owner and name = 'Himal Beverage & Tobacco Traders (Sample)';
-- end
-- $$;
