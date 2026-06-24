-- Widen user_subscriptions.status to the full Stripe subscription-status set, so the webhook can
-- persist whatever Stripe reports (incomplete during checkout, past_due / unpaid / paused, etc.).
-- Additive + reversible; the table is empty (dark).
alter table public.user_subscriptions drop constraint if exists user_subscriptions_status_check;
alter table public.user_subscriptions add constraint user_subscriptions_status_check
  check (status in ('active','trialing','past_due','canceled','incomplete','incomplete_expired','unpaid','paused'));
