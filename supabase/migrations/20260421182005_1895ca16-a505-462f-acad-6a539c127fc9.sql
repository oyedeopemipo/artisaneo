
-- Roles enum & user_roles table (separate from profiles to avoid privilege escalation)
create type public.app_role as enum ('buyer', 'seller', 'admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  city text,
  bio text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);
create policy "Users can insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "Users can view their own roles"
  on public.user_roles for select using (auth.uid() = user_id);
create policy "Users can insert their own roles"
  on public.user_roles for insert with check (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Service categories & listings
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  icon text
);
alter table public.categories enable row level security;
create policy "Categories are viewable by everyone" on public.categories for select using (true);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  title text not null,
  description text,
  price_pence integer not null,
  city text not null,
  image_url text,
  rating numeric(2,1) default 5.0,
  review_count integer default 0,
  created_at timestamptz not null default now()
);
alter table public.services enable row level security;
create policy "Services are viewable by everyone" on public.services for select using (true);
create policy "Sellers can insert own services" on public.services for insert with check (auth.uid() = seller_id);
create policy "Sellers can update own services" on public.services for update using (auth.uid() = seller_id);
create policy "Sellers can delete own services" on public.services for delete using (auth.uid() = seller_id);

insert into public.categories (slug, name, icon) values
  ('hair', 'Hairdressing', 'Scissors'),
  ('nails', 'Nails & Acrylics', 'Sparkles'),
  ('barbing', 'Barbing', 'Scissors'),
  ('catering', 'Catering', 'UtensilsCrossed'),
  ('painting', 'Painting', 'Paintbrush'),
  ('music', 'Instrumentalists', 'Music'),
  ('makeup', 'Makeup Artistry', 'Palette'),
  ('dj', 'DJ', 'Disc3'),
  ('tutoring', 'Tutoring', 'GraduationCap'),
  ('events', 'Event Help', 'PartyPopper'),
  ('photo', 'Photography', 'Camera');

-- Sample services (no seller_id so anyone can browse on first load)
insert into public.services (category_id, title, description, price_pence, city, rating, review_count) values
  ((select id from public.categories where slug='hair'), 'Bridal Hair Styling', 'Elegant updos and bridal hair for your special day, in-studio or on location.', 12000, 'London', 4.9, 87),
  ((select id from public.categories where slug='makeup'), 'Editorial Makeup Session', 'High-fashion makeup looks for shoots, events and weddings.', 9500, 'Manchester', 5.0, 42),
  ((select id from public.categories where slug='photo'), 'Portrait Photography', '90-min portrait session with 20 retouched images delivered.', 18000, 'Bristol', 4.8, 63),
  ((select id from public.categories where slug='catering'), 'Private Chef Dinner', 'Three-course dinner for up to 6 guests in your home.', 22000, 'Edinburgh', 4.9, 31),
  ((select id from public.categories where slug='dj'), 'Wedding DJ Set', '5-hour DJ set with full sound system and lighting.', 45000, 'Birmingham', 4.7, 54),
  ((select id from public.categories where slug='nails'), 'Acrylic Nail Set', 'Custom acrylic nail design with gel finish.', 4500, 'London', 4.8, 128),
  ((select id from public.categories where slug='barbing'), 'Premium Barber Cut', 'Skin fade, beard trim and hot towel finish.', 3500, 'Leeds', 4.9, 96),
  ((select id from public.categories where slug='tutoring'), 'GCSE Maths Tutoring', '1-hour private tuition, in-person or online.', 4000, 'Online', 5.0, 71);
