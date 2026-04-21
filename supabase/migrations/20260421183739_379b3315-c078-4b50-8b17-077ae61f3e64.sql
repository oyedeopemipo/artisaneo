CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TYPE public.booking_status AS ENUM ('pending', 'confirmed', 'cancelled');

CREATE TABLE public.bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  slot_id UUID NOT NULL REFERENCES public.service_slots(id) ON DELETE RESTRICT,
  buyer_id UUID NOT NULL,
  seller_id UUID NOT NULL,
  status public.booking_status NOT NULL DEFAULT 'pending',
  price_pence INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (slot_id)
);

CREATE INDEX idx_bookings_buyer ON public.bookings(buyer_id);
CREATE INDEX idx_bookings_seller ON public.bookings(seller_id);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view their bookings"
  ON public.bookings FOR SELECT
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Buyers can create their bookings"
  ON public.bookings FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Participants can update their bookings"
  ON public.bookings FOR UPDATE
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE OR REPLACE FUNCTION public.sync_slot_on_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.service_slots SET is_booked = true WHERE id = NEW.slot_id;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
      UPDATE public.service_slots SET is_booked = false WHERE id = NEW.slot_id;
    ELSIF NEW.status <> 'cancelled' AND OLD.status = 'cancelled' THEN
      UPDATE public.service_slots SET is_booked = true WHERE id = NEW.slot_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_slot_on_booking
AFTER INSERT OR UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.sync_slot_on_booking();

CREATE TRIGGER trg_bookings_updated_at
BEFORE UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();