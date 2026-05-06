
CREATE TABLE public.seller_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  full_name text NOT NULL,
  location text NOT NULL,
  bio text,
  photo_url text,
  shop_name text NOT NULL,
  service_category text NOT NULL,
  shop_description text NOT NULL,
  availability_days text[] NOT NULL DEFAULT '{}',
  availability_start time,
  availability_end time,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.seller_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Seller profiles are viewable by everyone"
  ON public.seller_profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert their own seller profile"
  ON public.seller_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own seller profile"
  ON public.seller_profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own seller profile"
  ON public.seller_profiles FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_seller_profiles_updated_at
  BEFORE UPDATE ON public.seller_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id, name, public)
VALUES ('seller-profile-photos', 'seller-profile-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Profile photos are publicly viewable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'seller-profile-photos');

CREATE POLICY "Users can upload own profile photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'seller-profile-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own profile photos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'seller-profile-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own profile photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'seller-profile-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
