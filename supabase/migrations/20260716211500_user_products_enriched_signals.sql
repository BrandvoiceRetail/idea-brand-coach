-- user_products: enriched review signals from the logged-out /dp/ page.
--
-- import-product-data's Firecrawl json extraction (scrapeAmazonPage with pageSignals)
-- now captures three page-level signals Amazon serves to anyone (no login): its
-- "Customers say" AI summary (synthesised over the FULL review corpus, including the
-- reviews behind the widget), the aspect sentiments, and the star-rating histogram.
-- run-forensic-analysis resurfaces them as Trust Gap evidence so the read leans on
-- Amazon's own full-corpus synthesis, not just the featured verbatim reviews.
--
-- GDPR: user_products is already a registered USER_ID_TABLE (see
-- supabase/functions/_shared/gdprData.ts), so these columns are covered by the
-- Art. 15 export (SELECT *) and Art. 17 erasure automatically — no registry change.

alter table public.user_products
  add column if not exists customers_say     text,
  add column if not exists review_aspects    jsonb,
  add column if not exists star_distribution jsonb;

comment on column public.user_products.customers_say is
  'Amazon "Customers say" AI summary (full-corpus synthesis) captured at scrape time.';
comment on column public.user_products.review_aspects is
  'Array of {aspect, sentiment} review-aspect highlights from the listing reviews module.';
comment on column public.user_products.star_distribution is
  'Star-rating histogram as {five,four,three,two,one} percentages.';
