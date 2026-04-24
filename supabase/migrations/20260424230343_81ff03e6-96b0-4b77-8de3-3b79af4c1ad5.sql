-- 1) Restrict user_roles self-insert to buyer/seller only (block admin self-grant)
DROP POLICY IF EXISTS "Users can insert their own roles" ON public.user_roles;
CREATE POLICY "Users can insert buyer or seller roles only"
  ON public.user_roles FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND role IN ('buyer'::public.app_role, 'seller'::public.app_role)
  );

-- 2) Split bookings UPDATE policies
DROP POLICY IF EXISTS "Participants can update their bookings" ON public.bookings;

CREATE POLICY "Sellers can update their bookings"
  ON public.bookings FOR UPDATE
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Buyers can cancel their bookings"
  ON public.bookings FOR UPDATE
  USING (auth.uid() = buyer_id)
  WITH CHECK (auth.uid() = buyer_id AND status = 'cancelled'::booking_status);

-- 3) Replace direct booking inserts with a SECURITY DEFINER RPC that validates server-side
DROP POLICY IF EXISTS "Buyers can create their bookings" ON public.bookings;

CREATE OR REPLACE FUNCTION public.create_booking(_service_id uuid, _slot_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _seller_id uuid;
  _price integer;
  _slot_service uuid;
  _is_booked boolean;
  _booking_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT seller_id, price_pence INTO _seller_id, _price
  FROM public.services WHERE id = _service_id;

  IF _seller_id IS NULL THEN
    RAISE EXCEPTION 'Service unavailable' USING ERRCODE = 'P0002';
  END IF;

  IF _uid = _seller_id THEN
    RAISE EXCEPTION 'Sellers cannot book their own services' USING ERRCODE = '42501';
  END IF;

  SELECT service_id, is_booked INTO _slot_service, _is_booked
  FROM public.service_slots WHERE id = _slot_id;

  IF _slot_service IS NULL OR _slot_service <> _service_id THEN
    RAISE EXCEPTION 'Invalid slot for this service' USING ERRCODE = '22023';
  END IF;

  IF _is_booked THEN
    RAISE EXCEPTION 'Slot already booked' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.bookings (service_id, slot_id, buyer_id, seller_id, price_pence)
  VALUES (_service_id, _slot_id, _uid, _seller_id, _price)
  RETURNING id INTO _booking_id;

  RETURN _booking_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_booking(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_booking(uuid, uuid) TO authenticated;