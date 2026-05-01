-- seller_applications table
CREATE TABLE public.seller_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  country TEXT NOT NULL,
  bio TEXT,
  shop_name TEXT NOT NULL,
  product_category TEXT NOT NULL,
  shop_description TEXT NOT NULL,
  sample_photo_url TEXT,
  payout_method TEXT NOT NULL,
  terms_agreed BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.seller_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can submit their own application"
  ON public.seller_applications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own applications"
  ON public.seller_applications FOR SELECT
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_seller_applications_updated_at
  BEFORE UPDATE ON public.seller_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for sample photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('seller-uploads', 'seller-uploads', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Seller upload images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'seller-uploads');

CREATE POLICY "Users can upload their own seller files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'seller-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own seller files"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'seller-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
