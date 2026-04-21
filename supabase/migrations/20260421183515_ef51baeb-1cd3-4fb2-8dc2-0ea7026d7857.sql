-- Service availability slots
CREATE TABLE public.service_slots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  is_booked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_service_slots_service_starts ON public.service_slots(service_id, starts_at);

ALTER TABLE public.service_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Slots are viewable by everyone"
  ON public.service_slots FOR SELECT USING (true);

CREATE POLICY "Sellers can insert own slots"
  ON public.service_slots FOR INSERT WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can update own slots"
  ON public.service_slots FOR UPDATE USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can delete own slots"
  ON public.service_slots FOR DELETE USING (auth.uid() = seller_id);

-- Enable realtime
ALTER TABLE public.service_slots REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.service_slots;

-- Seed sample upcoming slots for existing services (next 7 days)
INSERT INTO public.service_slots (service_id, seller_id, starts_at, ends_at)
SELECT
  s.id,
  COALESCE(s.seller_id, gen_random_uuid()),
  slot_time,
  slot_time + INTERVAL '1 hour'
FROM public.services s
CROSS JOIN LATERAL (
  SELECT now() + (n || ' hours')::interval AS slot_time
  FROM generate_series(2, 120, 6) AS n
  WHERE random() > 0.4
  LIMIT 5
) slots;