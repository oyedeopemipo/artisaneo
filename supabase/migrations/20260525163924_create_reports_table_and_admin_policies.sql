/*
  # Create reports table and admin access policies

  1. New Tables
    - `reports`
      - `id` (uuid, primary key)
      - `reporter_id` (uuid) — user who filed the report
      - `reported_user_id` (uuid, nullable) — user being reported
      - `booking_id` (uuid, nullable) — related booking
      - `reason` (text) — "inappropriate", "no_show", "payment_issue", "harassment", "other"
      - `description` (text) — detailed description
      - `status` (text) — "open", "under_review", "resolved", "dismissed"
      - `admin_notes` (text, nullable)
      - `resolved_by` (uuid, nullable) — admin who resolved
      - `resolved_at` (timestamptz, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security — RLS enabled on `reports`
    - Reporters can INSERT/SELECT their own reports
    - Admins can SELECT/UPDATE all reports
    - Uses existing has_role(user_id, role) function

  3. Admin access policies added to existing tables
    - `seller_applications`: Admin SELECT all, UPDATE (approve/reject)
    - `user_roles`: Admin SELECT all, INSERT any role, UPDATE roles
    - `profiles`: Admin UPDATE any profile (suspend accounts)
    - `bookings`: Admin SELECT all bookings
    - `seller_profiles`: Admin UPDATE seller profile status

  4. Schema changes
    - Added `suspended` boolean column to profiles (default false)

  5. Important notes
    - All admin policies use has_role(auth.uid(), 'admin')
    - The user_roles INSERT policy now allows admins to insert any role
*/

-- =============================================
-- Create reports table
-- =============================================
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  reason text NOT NULL DEFAULT 'other',
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved', 'dismissed')),
  admin_notes text,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can submit reports"
  ON reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view their own reports"
  ON reports FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);

CREATE POLICY "Admins can view all reports"
  ON reports FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update reports"
  ON reports FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_reporter_id ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_reported_user_id ON reports(reported_user_id);

-- =============================================
-- Add suspended column to profiles
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'suspended'
  ) THEN
    ALTER TABLE profiles ADD COLUMN suspended boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- =============================================
-- Admin policies for seller_applications
-- =============================================
CREATE POLICY "Admins can view all seller applications"
  ON seller_applications FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update seller applications"
  ON seller_applications FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- Admin policies for user_roles
-- =============================================
CREATE POLICY "Admins can view all roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert any role"
  ON user_roles FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update roles"
  ON user_roles FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- Admin policies for profiles
-- =============================================
CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- Admin policies for bookings
-- =============================================
CREATE POLICY "Admins can view all bookings"
  ON bookings FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- Admin policies for seller_profiles
-- =============================================
CREATE POLICY "Admins can update any seller profile"
  ON seller_profiles FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
