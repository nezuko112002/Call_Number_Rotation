-- Active conference room per live call (for Connect Call / 3-way).
-- Run in Supabase SQL editor after conference_participants migration.

create table if not exists call_conference_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  conference_name text not null unique,
  direction text not null check (direction in ('inbound', 'outbound')),
  lead_phone text not null,
  caller_id text not null,
  agent_identity text,
  lead_id uuid references leads(id) on delete set null,
  parent_call_sid text,
  agent_call_sid text,
  status text not null default 'active' check (status in ('active', 'ended')),
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create index if not exists call_conference_sessions_user_active_idx
  on call_conference_sessions (user_id, status, created_at desc);

comment on table call_conference_sessions is 'Maps a Twilio conference room to the agent user while a call is live.';
