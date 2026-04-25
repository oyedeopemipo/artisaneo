-- Unique partial index: at most one active (non-cancelled) booking per slot
CREATE UNIQUE INDEX IF NOT EXISTS bookings_active_slot_unique
  ON public.bookings (slot_id)
  WHERE status <> 'cancelled';

-- Replace create_booking with a version that locks the slot row (FOR UPDATE)
-- and re-validates ownership + availability under the lock.
CREATE OR REPLACE FUNCTION public.create_booking(_service_id uuid, _slot_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  -- Lock the slot row for the duration of this transaction so concurrent
  -- bookings serialize and re-check availability under the lock.
  SELECT service_id, seller_id, is_booked
    INTO _slot_service, _slot_seller, _is_booked
  FROM public.service_slots
  WHERE id = _slot_id
  FOR UPDATE;

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
$function$;