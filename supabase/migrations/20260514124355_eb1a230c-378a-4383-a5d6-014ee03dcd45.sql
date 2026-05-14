
-- Track sent emails to avoid duplicates (reminders, unread-message notifications)
CREATE TABLE IF NOT EXISTS public.email_notifications_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  ref_id text NOT NULL,
  recipient_user_id uuid,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, ref_id)
);

ALTER TABLE public.email_notifications_sent ENABLE ROW LEVEL SECURITY;

-- No client policies: only service role (edge functions) reads/writes this table.

-- Track when users were last active for "new message" notification logic
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

-- Enable extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
