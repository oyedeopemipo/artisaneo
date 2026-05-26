/*
  # Add full-text search to seller_profiles and services

  1. New columns
    - `seller_profiles.search_vector` — generated tsvector column combining
      full_name, bio, service_category, location, shop_name, shop_description.
      Automatically updated when any source column changes.
    - `services.search_vector` — generated tsvector column combining
      title, description, city. Automatically updated when any source column changes.

  2. Indexes
    - GIN index on `seller_profiles.search_vector` for fast full-text search
    - GIN index on `services.search_vector` for fast full-text search

  3. Trigger
    - `sync_display_name_to_seller_profile` — when `profiles.display_name`
      is updated, copies the value into `seller_profiles.full_name` so the
      search vector stays in sync.

  Important notes:
    - Generated columns cannot reference other tables, so `display_name`
      from `profiles` is synced via trigger into `seller_profiles.full_name`.
    - The GIN indexes enable Supabase's `.textSearch()` method to work
      efficiently on both tables.
    - No new data columns are added — only a generated column and indexes.
*/

-- ===========================================================
-- 1. Add search_vector generated column to seller_profiles
-- ===========================================================
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

-- ===========================================================
-- 2. GIN index on seller_profiles.search_vector
-- ===========================================================
CREATE INDEX IF NOT EXISTS idx_seller_profiles_search
  ON public.seller_profiles USING GIN (search_vector);

-- ===========================================================
-- 3. Add search_vector generated column to services
-- ===========================================================
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(city, '')), 'B')
  ) STORED;

-- ===========================================================
-- 4. GIN index on services.search_vector
-- ===========================================================
CREATE INDEX IF NOT EXISTS idx_services_search
  ON public.services USING GIN (search_vector);

-- ===========================================================
-- 5. Trigger to sync profiles.display_name → seller_profiles.full_name
-- ===========================================================
CREATE OR REPLACE FUNCTION public.sync_display_name_to_seller_profile()
  RETURNS trigger
  LANGUAGE plpgsql
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

-- Grant trigger function to appropriate roles
REVOKE EXECUTE ON FUNCTION public.sync_display_name_to_seller_profile() FROM PUBLIC;
