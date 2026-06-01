
REVOKE SELECT (stripe_account_id, stripe_onboarding_complete) ON public.seller_profiles FROM anon, authenticated;
GRANT SELECT (id, user_id, full_name, location, bio, photo_url, shop_name, service_category, shop_description,
              availability_days, availability_start, availability_end, status, created_at, updated_at)
  ON public.seller_profiles TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_my_stripe_status()
RETURNS TABLE(has_account boolean, complete boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (stripe_account_id IS NOT NULL) AS has_account,
         COALESCE(stripe_onboarding_complete, false) AS complete
  FROM public.seller_profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.get_my_stripe_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_stripe_status() TO authenticated;

DROP POLICY IF EXISTS "Users insert own notifications" ON public.notifications;

DROP POLICY IF EXISTS "Sellers can delete own seller-uploads" ON storage.objects;
CREATE POLICY "Sellers can delete own seller-uploads"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'seller-uploads'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );
