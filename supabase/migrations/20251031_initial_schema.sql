-- =====================================================
-- SnazzyAI Database Schema Migration
-- =====================================================

-- =====================================================
-- TABLES
-- =====================================================

-- Profiles table (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  email TEXT,
  birth DATE,
  gender TEXT,
  location TEXT,
  height INTEGER, -- in cm
  weight DECIMAL,
  currency TEXT DEFAULT 'USD',
  price_min INTEGER,
  price_max INTEGER,
  shirt_size TEXT,
  pants_size TEXT,
  shoe_size TEXT,
  favorite_brands TEXT[],
  favorite_styles TEXT[],
  language TEXT DEFAULT 'English',
  push_notifications BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Outfit analyses (history of all outfit analyses)
CREATE TABLE outfit_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  photo_url TEXT NOT NULL,
  outfit_name TEXT NOT NULL,
  short_description TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 0 AND rating <= 10),
  search_terms TEXT,
  is_valid_photo BOOLEAN DEFAULT true,
  analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product recommendations (cache of recommendations)
CREATE TABLE product_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID REFERENCES outfit_analyses ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  description TEXT,
  price TEXT,
  image_url TEXT,
  purchase_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  category TEXT DEFAULT 'other' CHECK (category IN ('shirts', 'pants', 'shoes', 'other'))
);

-- Favorite products (user's favorited products)
CREATE TABLE favorite_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  recommendation_id UUID REFERENCES product_recommendations ON DELETE CASCADE,
  name TEXT,
  brand TEXT,
  price TEXT,
  image_url TEXT,
  description TEXT,
  purchase_url TEXT,
  favorited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  category TEXT DEFAULT 'other' CHECK (category IN ('shirts', 'pants', 'shoes', 'other')),
  UNIQUE(user_id, recommendation_id)
);

-- Try-on results (virtual try-on history)
CREATE TABLE try_on_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  original_photo_url TEXT NOT NULL,
  product_image_url TEXT NOT NULL,
  result_image_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX outfit_analyses_user_id_idx ON outfit_analyses(user_id);
CREATE INDEX outfit_analyses_created_at_idx ON outfit_analyses(created_at DESC);
CREATE INDEX product_recommendations_analysis_id_idx ON product_recommendations(analysis_id);
CREATE INDEX favorite_products_user_id_idx ON favorite_products(user_id);
CREATE INDEX try_on_results_user_id_idx ON try_on_results(user_id);
CREATE INDEX try_on_results_created_at_idx ON try_on_results(created_at DESC);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE outfit_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorite_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE try_on_results ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES - PROFILES
-- =====================================================

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can delete own profile"
  ON profiles FOR DELETE
  USING (auth.uid() = id);

-- =====================================================
-- RLS POLICIES - OUTFIT ANALYSES
-- =====================================================

CREATE POLICY "Users can view own analyses"
  ON outfit_analyses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own analyses"
  ON outfit_analyses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own analyses"
  ON outfit_analyses FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- RLS POLICIES - PRODUCT RECOMMENDATIONS
-- =====================================================

CREATE POLICY "Users can view recommendations for their analyses"
  ON product_recommendations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM outfit_analyses
      WHERE outfit_analyses.id = product_recommendations.analysis_id
        AND outfit_analyses.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert recommendations"
  ON product_recommendations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can delete recommendations for their analyses"
  ON product_recommendations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM outfit_analyses
      WHERE outfit_analyses.id = product_recommendations.analysis_id
        AND outfit_analyses.user_id = auth.uid()
    )
  );

-- =====================================================
-- RLS POLICIES - FAVORITE PRODUCTS
-- =====================================================

CREATE POLICY "Users can view own favorites"
  ON favorite_products FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own favorites"
  ON favorite_products FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorites"
  ON favorite_products FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- RLS POLICIES - TRY-ON RESULTS
-- =====================================================

CREATE POLICY "Users can view own try-on results"
  ON try_on_results FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own try-on results"
  ON try_on_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own try-on results"
  ON try_on_results FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, created_at, updated_at)
  VALUES (new.id, new.email, NOW(), NOW());
  RETURN new;
END;
$$;

-- Trigger to call handle_new_user on auth.users insert
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Trigger to update updated_at on profiles
CREATE TRIGGER on_profile_updated
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
