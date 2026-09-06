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