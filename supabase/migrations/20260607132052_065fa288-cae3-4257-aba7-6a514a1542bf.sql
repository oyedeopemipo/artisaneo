
-- ============================================================
-- 1. Full-text search columns (fix broken /browse search)
-- ============================================================
ALTER TABLE public.seller_profiles
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(full_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(shop_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(service_category, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(location, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(bio, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(shop_description, '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_seller_profiles_search
  ON public.seller_profiles USING GIN (search_vector);

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(city, '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_services_search
  ON public.services USING GIN (search_vector);

-- Keep seller_profiles.full_name in sync with profiles.display_name
CREATE OR REPLACE FUNCTION public.sync_display_name_to_seller_profile()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public
  AS $$
BEGIN
  IF NEW.display_name IS DISTINCT FROM OLD.display_name AND NEW.display_name IS NOT NULL THEN
    UPDATE public.seller_profiles
      SET full_name = NEW.display_name
      WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_display_name ON public.profiles;
CREATE TRIGGER trg_sync_display_name
  AFTER UPDATE OF display_name ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_display_name_to_seller_profile();

REVOKE EXECUTE ON FUNCTION public.sync_display_name_to_seller_profile() FROM PUBLIC;

-- ============================================================
-- 2. Bookings: prevent buyers from editing payment/price fields
-- ============================================================
CREATE OR REPLACE FUNCTION public.protect_booking_buyer_update()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public
  AS $$
BEGIN
  -- Only enforce when the buyer (not seller, not service role) is updating
  IF auth.uid() = OLD.buyer_id AND auth.uid() <> OLD.seller_id THEN
    IF NEW.price_pence IS DISTINCT FROM OLD.price_pence
       OR NEW.stripe_payment_intent_id IS DISTINCT FROM OLD.stripe_payment_intent_id
       OR NEW.stripe_session_id IS DISTINCT FROM OLD.stripe_session_id
       OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
       OR NEW.application_fee_pence IS DISTINCT FROM OLD.application_fee_pence
       OR NEW.seller_id IS DISTINCT FROM OLD.seller_id
       OR NEW.buyer_id IS DISTINCT FROM OLD.buyer_id
       OR NEW.service_id IS DISTINCT FROM OLD.service_id
       OR NEW.slot_id IS DISTINCT FROM OLD.slot_id
       OR NEW.booking_date IS DISTINCT FROM OLD.booking_date
       OR NEW.booking_time IS DISTINCT FROM OLD.booking_time
       OR NEW.reference_number IS DISTINCT FROM OLD.reference_number
       OR NEW.service_type IS DISTINCT FROM OLD.service_type
    THEN
      RAISE EXCEPTION 'Buyers may only update booking status'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_booking_buyer_update ON public.bookings;
CREATE TRIGGER trg_protect_booking_buyer_update
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_booking_buyer_update();

-- ============================================================
-- 3. Conversations: only the buyer may initiate
-- ============================================================
DROP POLICY IF EXISTS "Participants can create conversations" ON public.conversations;
CREATE POLICY "Buyers can create conversations"
  ON public.conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = buyer_id AND buyer_id <> seller_id);

-- ============================================================
-- 4. Storage: seller-uploads insert/update restricted to authenticated
-- ============================================================
DROP POLICY IF EXISTS "Users can upload their own seller files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own seller files" ON storage.objects;

CREATE POLICY "Users can upload their own seller files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'seller-uploads'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own seller files"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'seller-uploads'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'seller-uploads'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );
