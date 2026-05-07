
-- Relax bookings constraints for direct-with-seller bookings
ALTER TABLE public.bookings ALTER COLUMN slot_id DROP NOT NULL;
ALTER TABLE public.bookings ALTER COLUMN service_id DROP NOT NULL;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS service_type text,
  ADD COLUMN IF NOT EXISTS booking_date date,
  ADD COLUMN IF NOT EXISTS booking_time time,
  ADD COLUMN IF NOT EXISTS reference_number text UNIQUE;

-- Allow buyers to insert their own bookings (no slot required)
CREATE POLICY "Buyers can create their bookings"
ON public.bookings
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = buyer_id);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  link text,
  booking_id uuid,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

-- Allow inserts via the trigger (security definer) and authenticated users for their own
CREATE POLICY "Users insert own notifications"
ON public.notifications FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, created_at DESC);

-- Trigger to create buyer + seller notifications on new booking
CREATE OR REPLACE FUNCTION public.notify_on_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ref text := COALESCE(NEW.reference_number, substring(NEW.id::text, 1, 8));
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, booking_id, link)
  VALUES (
    NEW.buyer_id,
    'booking_created',
    'Booking request sent',
    'Your booking ' || _ref || ' has been submitted and is awaiting confirmation.',
    NEW.id,
    '/seller/' || NEW.seller_id::text
  );

  INSERT INTO public.notifications (user_id, type, title, message, booking_id, link)
  VALUES (
    NEW.seller_id,
    'booking_received',
    'New booking request',
    'You received a new booking request ' || _ref || '.',
    NEW.id,
    '/seller/profile'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_booking ON public.bookings;
CREATE TRIGGER trg_notify_on_booking
AFTER INSERT ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.notify_on_booking();
