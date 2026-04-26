
CREATE TABLE public.service_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL,
  user_id uuid NOT NULL,
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_id, user_id)
);

CREATE INDEX idx_service_waitlist_service ON public.service_waitlist(service_id);
CREATE INDEX idx_service_waitlist_user ON public.service_waitlist(user_id);

ALTER TABLE public.service_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own waitlist entries"
ON public.service_waitlist FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Sellers can view waitlist for own services"
ON public.service_waitlist FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.services s
  WHERE s.id = service_waitlist.service_id AND s.seller_id = auth.uid()
));

CREATE POLICY "Users can join waitlist"
ON public.service_waitlist FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave waitlist"
ON public.service_waitlist FOR DELETE
USING (auth.uid() = user_id);
