-- Fixes for what Supabase's database advisors found on the first deployed
-- project. Nobody can see or do anything they couldn't before.
--
-- 1. Row-level security policies called auth.uid(), has_write_access() and
--    current_setting() once for every row they checked. Wrapped in a
--    sub-select, each runs once per statement instead, which matters for long
--    lists and bulk writes such as an import.
-- 2. Foreign keys without an index get one, so finding a party's cheques or an
--    account's deposits, and deleting rows they point at, don't scan the whole
--    table.
-- 3. Supabase's "automatic RLS" project setting adds public.rls_auto_enable(),
--    a SECURITY DEFINER function run by an event trigger, and anyone could
--    execute it through the API. Postgres refuses to run an event trigger
--    function any other way, so it did no harm, but nobody needs to call it.
--    The event trigger keeps working: Postgres doesn't check EXECUTE when it
--    fires one.

-- ---------------------------------------------------------------------------
-- 1. Once per statement, not once per row
-- ---------------------------------------------------------------------------

-- Own rows.
ALTER POLICY "Users can only access own parties" ON public.parties
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY "Users can only access own cheques" ON public.cheques
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY "Users can only access own deposits" ON public.daily_deposits
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY "Users can only access own settings" ON public.settings
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY "Users can only access own bank accounts" ON public.bank_accounts
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY "Users can only access own received cheques" ON public.received_cheques
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY "Users can read own entitlements" ON public.entitlements
  USING ((SELECT auth.uid()) = user_id);

-- History of own cheques.
ALTER POLICY "Users can read own cheque history" ON public.cheque_history
  USING (EXISTS (
    SELECT 1 FROM public.cheques
    WHERE cheques.id = cheque_history.cheque_id AND cheques.user_id = (SELECT auth.uid())
  ));
ALTER POLICY "Users can add history to own cheques" ON public.cheque_history
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.cheques
    WHERE cheques.id = cheque_history.cheque_id AND cheques.user_id = (SELECT auth.uid())
  ));
ALTER POLICY "Users can read own received cheque history" ON public.received_cheque_history
  USING (EXISTS (
    SELECT 1 FROM public.received_cheques rc
    WHERE rc.id = received_cheque_history.cheque_id AND rc.user_id = (SELECT auth.uid())
  ));
ALTER POLICY "Actions can add history to own received cheques" ON public.received_cheque_history
  WITH CHECK (
    coalesce((SELECT current_setting('app.received_lifecycle', true)), '') = 'on'
    AND EXISTS (
      SELECT 1 FROM public.received_cheques rc
      WHERE rc.id = received_cheque_history.cheque_id AND rc.user_id = (SELECT auth.uid())
    )
  );

-- Writes need an active plan.
ALTER POLICY "Inserts need an active plan" ON public.parties WITH CHECK ((SELECT public.has_write_access()));
ALTER POLICY "Updates need an active plan" ON public.parties USING ((SELECT public.has_write_access()));
ALTER POLICY "Deletes need an active plan" ON public.parties USING ((SELECT public.has_write_access()));

ALTER POLICY "Inserts need an active plan" ON public.cheques WITH CHECK ((SELECT public.has_write_access()));
ALTER POLICY "Updates need an active plan" ON public.cheques USING ((SELECT public.has_write_access()));
ALTER POLICY "Deletes need an active plan" ON public.cheques USING ((SELECT public.has_write_access()));

ALTER POLICY "Inserts need an active plan" ON public.cheque_history WITH CHECK ((SELECT public.has_write_access()));

ALTER POLICY "Inserts need an active plan" ON public.daily_deposits WITH CHECK ((SELECT public.has_write_access()));
ALTER POLICY "Updates need an active plan" ON public.daily_deposits USING ((SELECT public.has_write_access()));
ALTER POLICY "Deletes need an active plan" ON public.daily_deposits USING ((SELECT public.has_write_access()));

ALTER POLICY "Inserts need an active plan" ON public.bank_accounts WITH CHECK ((SELECT public.has_write_access()));
ALTER POLICY "Updates need an active plan" ON public.bank_accounts USING ((SELECT public.has_write_access()));
ALTER POLICY "Deletes need an active plan" ON public.bank_accounts USING ((SELECT public.has_write_access()));

ALTER POLICY "Inserts need an active plan" ON public.received_cheques WITH CHECK ((SELECT public.has_write_access()));
ALTER POLICY "Updates need an active plan" ON public.received_cheques USING ((SELECT public.has_write_access()));
ALTER POLICY "Deletes need an active plan" ON public.received_cheques USING ((SELECT public.has_write_access()));

ALTER POLICY "Inserts need an active plan" ON public.received_cheque_history WITH CHECK ((SELECT public.has_write_access()));

-- ---------------------------------------------------------------------------
-- 2. Indexes for foreign keys
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_cheques_party ON public.cheques (party_id);
CREATE INDEX IF NOT EXISTS idx_cheques_replaces ON public.cheques (replaces_cheque_id) WHERE replaces_cheque_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cheque_history_reverts ON public.cheque_history (reverts_history_id) WHERE reverts_history_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_received_account ON public.received_cheques (deposit_account_id) WHERE deposit_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_received_history_reverts ON public.received_cheque_history (reverts_history_id) WHERE reverts_history_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. Supabase's automatic-RLS helper, where the project has one
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated';
  END IF;
END;
$$;
