/*
  # Fix security issues v3: tighten policies and revoke grants

  1. Remove overly permissive "Buyers can update slots for booking" policy
    - This policy with USING (true) allowed any authenticated user to update
      any service_slot row via the REST API — too dangerous
    - The create_booking function doesn't UPDATE slots itself; the
      trg_sync_slot_on_booking trigger handles that as the table owner
    - Replace FOR UPDATE with pg_advisory_xact_lock for concurrency safety
      without needing UPDATE permission on service_slots

  2. Revoke PUBLIC EXECUTE from internal SECURITY DEFINER helpers
    - sync_user_roles_to_app_meta and trg_sync_roles_to_meta still had
      PUBLIC grants after recreation; revoke them

  3. Recreate create_booking using advisory locks instead of FOR UPDATE
    - pg_advisory_xact_lock locks by slot ID, released at transaction end
    - Still checks is_booked manually for correctness
    - No need for UPDATE privilege on service_slots
*/

-- ===========================================================
-- 1. Remove overly broad UPDATE policy on service_slots
-- ===========================================================
DROP POLICY IF EXISTS "Buyers can update slots for booking" ON public.service_slots;

-- ===========================================================
-- 2. Recreate create_booking with advisory lock instead of FOR UPDATE
-- ===========================================================
CREATE OR REPLACE FUNCTION public.create_booking(_service_id uuid, _slot_id uuid)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = ''
  AS $$
DECLARE
  _uid uuid := auth.uid();
  _seller_id uuid;
  _price integer;
  _slot_service uuid;
  _slot_seller uuid;
  _is_booked boolean;
  _booking_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  -- Load + validate the service
  SELECT seller_id, price_pence INTO _seller_id, _price
  FROM public.services WHERE id = _service_id;

  IF _seller_id IS NULL THEN
    RAISE EXCEPTION 'Service unavailable' USING ERRCODE = 'P0002';
  END IF;

  IF _uid = _seller_id THEN
    RAISE EXCEPTION 'Sellers cannot book their own services' USING ERRCODE = '42501';
  END IF;

  -- Use advisory lock to serialize concurrent bookings for the same slot.
  -- Lock is automatically released at transaction end.
  PERFORM pg_advisory_xact_lock(
    ('public.service_slots'::text)::bigint,
    (SELECT hash_record_extended(row(id), 0) FROM public.service_slots WHERE id = _slot_id)
  );

  -- Read slot state (no FOR UPDATE needed — advisory lock prevents races)
  SELECT service_id, seller_id, is_booked
  INTO _slot_service, _slot_seller, _is_booked
  FROM public.service_slots
  WHERE id = _slot_id;

  IF _slot_service IS NULL THEN
    RAISE EXCEPTION 'Invalid slot' USING ERRCODE = '22023';
  END IF;

  -- Server-side validation: slot must belong to the chosen service
  IF _slot_service <> _service_id THEN
    RAISE EXCEPTION 'Invalid slot for this service' USING ERRCODE = '22023';
  END IF;

  -- Defensive: slot's seller must match the service's seller
  IF _slot_seller IS DISTINCT FROM _seller_id THEN
    RAISE EXCEPTION 'Invalid slot for this service' USING ERRCODE = '22023';
  END IF;

  -- Server-side validation: slot must currently be unbooked
  IF _is_booked THEN
    RAISE EXCEPTION 'Slot already booked' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.bookings (service_id, slot_id, buyer_id, seller_id, price_pence)
  VALUES (_service_id, _slot_id, _uid, _seller_id, _price)
  RETURNING id INTO _booking_id;

  RETURN _booking_id;
END;
$$;

-- ===========================================================
-- 3. Revoke PUBLIC EXECUTE from internal SECURITY DEFINER helpers
-- ===========================================================
REVOKE EXECUTE ON FUNCTION public.sync_user_roles_to_app_meta(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_sync_roles_to_meta() FROM PUBLIC;

-- Also revoke from anon and authenticated explicitly for defense in depth
REVOKE EXECUTE ON FUNCTION public.sync_user_roles_to_app_meta(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_user_roles_to_app_meta(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_sync_roles_to_meta() FROM anon;
REVOKE EXECUTE ON FUNCTION public.trg_sync_roles_to_meta() FROM authenticated;
