create extension if not exists "uuid-ossp";

create table if not exists did_pool (
  id uuid primary key default uuid_generate_v4(),
  did text not null unique,
  area_code text not null,
  status text not null default 'active' check (status in ('active', 'cooldown', 'retired')),
  calls_today integer not null default 0,
  total_calls integer not null default 0,
  answer_rate numeric(5,2) not null default 0,
  spam_score numeric(5,2) not null default 0,
  last_used timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists leads (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  phone text not null,
  area_code text not null,
  status text not null default 'pending' check (status in ('pending', 'dialed', 'completed')),
  assigned_did text,
  result text,
  created_at timestamptz not null default now()
);

create table if not exists call_logs (
  id uuid primary key default uuid_generate_v4(),
  phone text not null,
  did text not null,
  result text not null,
  timestamp timestamptz not null default now(),
  duration integer,
  created_at timestamptz not null default now()
);

create table if not exists notes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null unique,
  content text not null default '',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
