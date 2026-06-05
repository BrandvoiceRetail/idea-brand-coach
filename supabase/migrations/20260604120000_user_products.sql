-- ============================================
-- User Products Tables
-- Stores imported Amazon listings (by ASIN) and their embedded reviews
-- Source: import-product-data edge function (Firecrawl v2 scrape of /dp/{asin})
-- ============================================

-- Create user_products table
CREATE TABLE IF NOT EXISTS public.user_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asin TEXT NOT NULL,
  title TEXT,
  price NUMERIC(10, 2),
  rating NUMERIC(2, 1) CHECK (rating >= 0 AND rating <= 5),
  review_count INTEGER NOT NULL DEFAULT 0,
  bullets JSONB NOT NULL DEFAULT '[]'::jsonb,
  description TEXT,
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_url TEXT,
  status TEXT NOT NULL DEFAULT 'completed'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  scraped_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, asin)
);

-- Enable RLS on user_products
ALTER TABLE public.user_products ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_products
CREATE POLICY "Users can view their own products"
ON public.user_products FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own products"
ON public.user_products FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own products"
ON public.user_products FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own products"
ON public.user_products FOR DELETE
USING (auth.uid() = user_id);

-- Index for user_products (newest-first listing per user)
CREATE INDEX IF NOT EXISTS idx_user_products_user_id
ON public.user_products(user_id, scraped_at DESC);

-- Trigger to auto-update user_products.updated_at
DROP TRIGGER IF EXISTS update_user_products_updated_at ON public.user_products;
CREATE TRIGGER update_user_products_updated_at
  BEFORE UPDATE ON public.user_products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Grant permissions
GRANT ALL ON public.user_products TO authenticated;

-- ============================================
-- User Product Reviews Table
-- Stores individual reviews embedded in each imported listing
-- ============================================

-- Create user_product_reviews table
CREATE TABLE IF NOT EXISTS public.user_product_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.user_products(id) ON DELETE CASCADE,
  reviewer_name TEXT,
  rating NUMERIC(2, 1) CHECK (rating >= 0 AND rating <= 5),
  title TEXT,
  body TEXT NOT NULL,
  review_date TEXT,
  verified_purchase BOOLEAN NOT NULL DEFAULT false,
  source_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on user_product_reviews
ALTER TABLE public.user_product_reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_product_reviews (access via product ownership)
CREATE POLICY "Users can view reviews for their products"
ON public.user_product_reviews FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_products
    WHERE id = user_product_reviews.product_id
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert reviews for their products"
ON public.user_product_reviews FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_products
    WHERE id = user_product_reviews.product_id
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete reviews for their products"
ON public.user_product_reviews FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_products
    WHERE id = user_product_reviews.product_id
    AND user_id = auth.uid()
  )
);

-- Index for user_product_reviews (lookup by product)
CREATE INDEX IF NOT EXISTS idx_user_product_reviews_product_id
ON public.user_product_reviews(product_id);

-- Grant permissions
GRANT ALL ON public.user_product_reviews TO authenticated;
