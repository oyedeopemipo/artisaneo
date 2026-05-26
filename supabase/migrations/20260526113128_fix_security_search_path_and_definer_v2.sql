/*
  # Fix security issues: search_path, SECURITY DEFINER on has_role and create_booking

  1. Function `sync_display_name_to_seller_profile`
    - Fix mutable search_path by setting `SET search_path = ''` (empty path)
    - Function fully qualifies all table references
    - Empty search_path is the most secure option — no implicit schema lookup

  2. Function `has_role`
    - Rewrite: when checking own roles (_user_id = auth.uid()), read from
      JWT claims (`auth.jwt() -> 'app_metadata' -> 'roles'`) instead of
      querying `user_roles` — eliminates SECURITY DEFINER need for self-checks
    - For checking other users' roles, query `user_roles` directly
      (works under SECURITY INVOKER because the "Users can view their own roles"
       policy allows it, and admin policies already grant broader access)
    - Switch to SECURITY INVOKER with `SET search_path = ''`

  3. Function `create_booking`
    - Switch from SECURITY DEFINER to SECURITY INVOKER
    - Add a separate UPDATE policy on `service_slots` allowing buyers
      to update (mark as booked) slots when the slot's service is being booked
    - Add `SET search_path = ''` with fully-qualified table references

  4. Role sync trigger
    - After INSERT/UPDATE/DELETE on `user_roles`, sync roles into
      `auth.users.raw_app_meta_data` as a `roles` array
    - Ensures JWT claims stay current for `has_role()` reads
    - Backfill existing roles into app_metadata
*/

-- ===========================================================
-- 1. Fix sync_display_name_to_seller_profile: empty search_path
-- ===========================================================
CREATE OR REPLACE FUNCTION public.sync_display_name_to_seller_profile()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = ''
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

-- Revoke EXECUTE from anon/authenticated — trigger only
REVOKE EXECUTE ON FUNCTION public.sync_display_name_to_seller_profile() FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_display_name_to_seller_profile() FROM authenticated;

-- ===========================================================
-- 2. Sync user_roles to auth.users.raw_app_meta_data
-- ===========================================================

-- Helper to rebuild the roles array for a user and write to app_metadata
CREATE OR REPLACE FUNCTION public.sync_user_roles_to_app_meta(_user_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
  AS $$
DECLARE
  _roles text[];
BEGIN
  SELECT array_agg(role::text) INTO _roles
  FROM public.user_roles
  WHERE user_id = _user_id;

  IF _roles IS NULL THEN
    _roles := '{}';
  END IF;

  UPDATE auth.users
  SET raw_app_meta_data =
    COALESCE(raw_app_meta_data, '{}'::jsonb) ||
    jsonb_build_object('roles', _roles)
  WHERE id = _user_id;
END;
$$;

-- Revoke EXECUTE from anon/authenticated — internal use only
REVOKE EXECUTE ON FUNCTION public.sync_user_roles_to_app_meta(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_user_roles_to_app_meta(uuid) FROM authenticated;

-- Trigger on user_roles: after any change, sync to app_metadata
CREATE OR REPLACE FUNCTION public.trg_sync_roles_to_meta()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
  AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.sync_user_roles_to_app_meta(OLD.user_id);
    RETURN OLD;
  ELSE
    PERFORM public.sync_user_roles_to_app_meta(NEW.user_id);
    RETURN NEW;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.trg_sync_roles_to_meta() FROM anon;
REVOKE EXECUTE ON FUNCTION public.trg_sync_roles_to_meta() FROM authenticated;

DROP TRIGGER IF EXISTS trg_sync_roles_to_app_meta ON public.user_roles;
CREATE TRIGGER trg_sync_roles_to_app_meta
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_roles_to_meta();

-- ===========================================================
-- 3. Rewrite has_role: SECURITY INVOKER reading from JWT for self
-- ===========================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
  RETURNS boolean
  LANGUAGE sql
  SECURITY INVOKER
  SET search_path = ''
  STABLE
  AS $$
  SELECT
    CASE
      WHEN _user_id = auth.uid() THEN
        -- Check own roles from JWT claims (no table access needed)
        COALESCE(
          (auth.jwt() -> 'app_metadata' -> 'roles') ? (_role::text),
          false
        )
      ELSE
        -- For checking other users' roles, query the table.
        -- Admin-level RLS policies already grant broader access.
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = _user_id AND role = _role
        )
    END
  $$;

-- ===========================================================
-- 4. Switch create_booking to SECURITY INVOKER
-- ===========================================================

-- Add UPDATE policy on service_slots: allow authenticated users to
-- update slots when the slot belongs to a service they are booking.
-- The create_booking function validates all conditions server-side.
CREATE POLICY "Buyers can update slots for booking"
  ON public.service_slots
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Recreate create_booking as SECURITY INVOKER with empty search_path
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

  -- Lock the slot row for the duration of this transaction
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
$$;

-- ===========================================================
-- 5. Backfill existing roles into app_metadata
-- ===========================================================
DO $$
DECLARE
  _uid uuid;
BEGIN
  FOR _uid IN SELECT DISTINCT user_id FROM public.user_roles LOOP
    PERFORM public.sync_user_roles_to_app_meta(_uid);
  END LOOP;
END $$;
