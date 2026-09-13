-- Stations
create table stations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text not null,
  location text not null,
  created_at timestamptz default now()
);

insert into stations (name, brand, location) values
  ('7 Hills Filling Station', 'Nayara', 'Mallepalli'),
  ('HP Filling Station', 'HP', 'Perusamula');

-- Users (linked to Supabase Auth)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role text not null check (role in ('uncle', 'father', 'owner')),
  station_id uuid references stations(id),
  created_at timestamptz default now()
);

-- Fuel types per station (petrol, diesel, with nozzle count and commission rate)
create table fuel_types (
  id uuid primary key default gen_random_uuid(),
  station_id uuid references stations(id) not null,
  fuel_name text not null,
  nozzle_count int not null default 1,
  commission_per_liter numeric(10,2) not null default 0,
  created_at timestamptz default now()
);

-- Daily sales entries, one row per nozzle per day
create table daily_entries (
  id uuid primary key default gen_random_uuid(),
  station_id uuid references stations(id) not null,
  fuel_type_id uuid references fuel_types(id) not null,
  nozzle_number int not null,
  entry_date date not null,
  opening_reading numeric(12,2) not null,
  closing_reading numeric(12,2) not null,
  rate_per_liter numeric(10,2) not null,
  entered_by uuid references profiles(id),
  created_at timestamptz default now(),
  unique (fuel_type_id, nozzle_number, entry_date)
);

-- Payments collected per station per day
create table daily_payments (
  id uuid primary key default gen_random_uuid(),
  station_id uuid references stations(id) not null,
  entry_date date not null,
  cash numeric(12,2) default 0,
  upi numeric(12,2) default 0,
  card numeric(12,2) default 0,
  credit numeric(12,2) default 0,
  entered_by uuid references profiles(id),
  created_at timestamptz default now(),
  unique (station_id, entry_date)
);

-- Stock/tank readings and deliveries
create table stock_entries (
  id uuid primary key default gen_random_uuid(),
  station_id uuid references stations(id) not null,
  fuel_type_id uuid references fuel_types(id) not null,
  entry_date date not null,
  dip_reading_liters numeric(12,2) not null,
  delivery_liters numeric(12,2) default 0,
  delivery_invoice_amount numeric(12,2) default 0,
  entered_by uuid references profiles(id),
  created_at timestamptz default now(),
  unique (fuel_type_id, entry_date)
);

-- Expenses
create table expenses (
  id uuid primary key default gen_random_uuid(),
  station_id uuid references stations(id) not null,
  entry_date date not null,
  category text not null check (category in ('staff_salary', 'electricity', 'maintenance', 'transport', 'other')),
  amount numeric(12,2) not null,
  notes text,
  entered_by uuid references profiles(id),
  created_at timestamptz default now()
);
-- Turn on RLS for every table
alter table stations enable row level security;
alter table profiles enable row level security;
alter table fuel_types enable row level security;
alter table daily_entries enable row level security;
alter table daily_payments enable row level security;
alter table stock_entries enable row level security;
alter table expenses enable row level security;

-- Helper: get the logged-in user's role
create or replace function get_my_role()
returns text as $$
  select role from profiles where id = auth.uid();
$$ language sql security definer stable;

-- Helper: get the logged-in user's assigned station
create or replace function get_my_station()
returns uuid as $$
  select station_id from profiles where id = auth.uid();
$$ language sql security definer stable;

-- Stations: anyone logged in can view both stations (needed for dropdowns)
create policy "view stations" on stations for select
  to authenticated using (true);

-- Profiles: see your own profile, owner sees everyone's
create policy "view profiles" on profiles for select
  to authenticated using (id = auth.uid() or get_my_role() = 'owner');

-- Fuel types: anyone logged in can view
create policy "view fuel_types" on fuel_types for select
  to authenticated using (true);

-- Daily entries: owner + father see everything, uncle sees only their station
create policy "view daily_entries" on daily_entries for select
  to authenticated using (
    get_my_role() in ('owner','father') or station_id = get_my_station()
  );
create policy "insert daily_entries" on daily_entries for insert
  to authenticated with check (
    get_my_role() = 'owner' or station_id = get_my_station()
  );
create policy "update daily_entries" on daily_entries for update
  to authenticated using (
    get_my_role() = 'owner' or station_id = get_my_station()
  );

-- Daily payments (same pattern)
create policy "view daily_payments" on daily_payments for select
  to authenticated using (
    get_my_role() in ('owner','father') or station_id = get_my_station()
  );
create policy "insert daily_payments" on daily_payments for insert
  to authenticated with check (
    get_my_role() = 'owner' or station_id = get_my_station()
  );
create policy "update daily_payments" on daily_payments for update
  to authenticated using (
    get_my_role() = 'owner' or station_id = get_my_station()
  );

-- Stock entries (same pattern)
create policy "view stock_entries" on stock_entries for select
  to authenticated using (
    get_my_role() in ('owner','father') or station_id = get_my_station()
  );
create policy "insert stock_entries" on stock_entries for insert
  to authenticated with check (
    get_my_role() = 'owner' or station_id = get_my_station()
  );
create policy "update stock_entries" on stock_entries for update
  to authenticated using (
    get_my_role() = 'owner' or station_id = get_my_station()
  );

-- Expenses (same pattern)
create policy "view expenses" on expenses for select
  to authenticated using (
    get_my_role() in ('owner','father') or station_id = get_my_station()
  );
create policy "insert expenses" on expenses for insert
  to authenticated with check (
    get_my_role() = 'owner' or station_id = get_my_station()
  );
create policy "update expenses" on expenses for update
  to authenticated using (
    get_my_role() = 'owner' or station_id = get_my_station()
  );

  -- User profiles (Afrid/owner, Father, Uncle) seeded manually in Supabase with real account data, not included here
  