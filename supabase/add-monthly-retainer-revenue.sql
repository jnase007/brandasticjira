-- Dedicated Brandastic monthly retainer revenue. Do not reuse estimated_budget (Monthly Budget).
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS monthly_retainer_revenue NUMERIC(12,2);

COMMENT ON COLUMN public.clients.monthly_retainer_revenue IS
  'Amount Brandastic invoices the client each month. Not paid-media budget and not hours × rate.';
