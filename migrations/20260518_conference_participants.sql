-- Saved contacts for 3-way / conference connect (run in Supabase SQL editor).

create table if not exists conference_participants (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  label text not null,
  phone text not null,
  normalized_phone text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, normalized_phone)
);

comment on table conference_participants is 'Per-user saved numbers to dial into an active conference call from Connect Call.';
comment on column conference_participants.normalized_phone is 'Digits-only key for duplicate detection within a user account.';

create index if not exists conference_participants_user_sort_idx
  on conference_participants (user_id, sort_order asc, created_at asc);
