-- Allow authenticated team to save hourly rates on client_rates.
-- Live table has `rate` (not hourly_rate). Anon key cannot run this.
-- Paste in Supabase SQL editor if Edit Client still cannot save Hourly Billing Rate.

ALTER TABLE public.client_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view client_rates" ON public.client_rates;
CREATE POLICY "Authenticated can view client_rates"
  ON public.client_rates
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated can manage client_rates" ON public.client_rates;
CREATE POLICY "Authenticated can manage client_rates"
  ON public.client_rates
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
