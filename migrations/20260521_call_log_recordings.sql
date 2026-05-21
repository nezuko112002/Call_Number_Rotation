-- Link Twilio conference recordings to call_logs for superadmin replay.

alter table call_logs
  add column if not exists conference_name text,
  add column if not exists twilio_recording_sid text,
  add column if not exists recording_url text;

create index if not exists call_logs_conference_name_idx
  on call_logs (conference_name)
  where conference_name is not null;

comment on column call_logs.conference_name is 'Twilio conference friendly name (cnf-…) for recording lookup.';
comment on column call_logs.twilio_recording_sid is 'Twilio Recording SID when a call was recorded.';
comment on column call_logs.recording_url is 'Twilio RecordingUrl from status callback (may expire; use recording SID proxy as fallback).';

-- Recording may complete before call_logs row exists (race with status callback).
create table if not exists pending_call_recordings (
  conference_name text primary key,
  twilio_recording_sid text not null,
  recording_url text not null,
  recording_duration integer,
  created_at timestamptz not null default now()
);

comment on table pending_call_recordings is 'Buffers Twilio recording metadata until matching call_logs row is inserted.';
