-- App users (linked to auth.users) with role-based access.
create table if not exists users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role text not null default 'agent',
  created_at timestamptz not null default now()
);

alter table users drop constraint if exists users_role_check;
alter table users
  add constraint users_role_check check (role in ('agent', 'admin', 'superadmin'));

create index if not exists users_role_idx on users (role);

-- Outbound dial stats for superadmin shift windows.
create index if not exists call_logs_user_outbound_timestamp_idx
  on call_logs (user_id, timestamp desc)
  where direction = 'outbound' and user_id is not null;
