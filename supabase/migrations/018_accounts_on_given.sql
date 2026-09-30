-- 018: The account a given cheque is drawn on, and the account funds went into
--
-- Plan items 77 and 78. Your bank accounts (migration 012) become the one list
-- for both directions: a cheque you give names the account it's drawn on, and
-- "Add funds" names the account the money went into, so it can cover that
-- account's cheques. Two accounts at the same bank can now be told apart.
--
-- Additive: both columns are nullable, older rows keep their bank name only,
-- and `cheques.bank_name` is still filled in, so cheque-mcp and Cheque Watch,
-- which read these tables, are unaffected.

ALTER TABLE public.cheques
  ADD COLUMN bank_account_id uuid REFERENCES public.bank_accounts(id);

ALTER TABLE public.daily_deposits
  ADD COLUMN bank_account_id uuid REFERENCES public.bank_accounts(id);

COMMENT ON COLUMN public.cheques.bank_account_id IS
  'The account the cheque is drawn on, if known. bank_name is still filled in from it.';
COMMENT ON COLUMN public.daily_deposits.bank_account_id IS
  'The account the money went into, if known.';

CREATE INDEX idx_cheques_bank_account ON public.cheques (bank_account_id);
CREATE INDEX idx_daily_deposits_bank_account ON public.daily_deposits (bank_account_id);

-- ---------------------------------------------------------------------------
-- Foreign keys don't check row-level security, so make sure the account is
-- one of the user's own (the lookup runs with their rights). Only checked when
-- the account changes, so a later removal doesn't block other edits.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.check_own_bank_account()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.bank_account_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.bank_account_id IS DISTINCT FROM OLD.bank_account_id)
     AND NOT EXISTS (SELECT 1 FROM bank_accounts WHERE id = NEW.bank_account_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Bank account not found' USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.check_own_bank_account() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER cheques_own_bank_account
  BEFORE INSERT OR UPDATE OF bank_account_id ON public.cheques
  FOR EACH ROW EXECUTE FUNCTION public.check_own_bank_account();

CREATE TRIGGER daily_deposits_own_bank_account
  BEFORE INSERT OR UPDATE OF bank_account_id ON public.daily_deposits
  FOR EACH ROW EXECUTE FUNCTION public.check_own_bank_account();

-- ---------------------------------------------------------------------------
-- record_deposit takes the account. Callers that leave it out work as before.
-- ---------------------------------------------------------------------------
DROP FUNCTION public.record_deposit(numeric, date, uuid[], text);

CREATE FUNCTION public.record_deposit(
  p_amount       numeric,
  p_deposit_date date,
  p_cheque_ids   uuid[] DEFAULT '{}',
  p_notes        text DEFAULT NULL,
  p_account_id   uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_deposit_id uuid;
  v_cheque_id  uuid;
  v_note       text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Deposit amount must be positive' USING ERRCODE = '22023';
  END IF;

  INSERT INTO daily_deposits (user_id, amount, deposit_date, notes, bank_account_id)
  VALUES (auth.uid(), p_amount, p_deposit_date, nullif(btrim(p_notes), ''), p_account_id)
  RETURNING id INTO v_deposit_id;

  v_note := CASE
    WHEN nullif(btrim(p_notes), '') IS NULL THEN 'Deposit allocation'
    ELSE 'Deposit allocation: ' || btrim(p_notes)
  END;

  FOREACH v_cheque_id IN ARRAY coalesce(p_cheque_ids, '{}') LOOP
    PERFORM public.change_cheque_status(v_cheque_id, 'DEPOSITED', 'deposit_allocation', v_note);
  END LOOP;

  RETURN v_deposit_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_deposit(numeric, date, uuid[], text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_deposit(numeric, date, uuid[], text, uuid) TO authenticated;
