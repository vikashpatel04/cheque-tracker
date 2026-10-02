-- 019: The Free plan ("finishing mode") after a trial or plan ends
--
-- Plan items 55 and 84, decided on 2026-10-02. On instances with billing on,
-- an account without an active trial or Business plan is on the Free plan:
--
-- - It can still move its cheques along: every status change on both sides
--   (fund, pass, return, present again, write off, deposit, clear, bounce,
--   re-deposit, settle, hand back), undo, and add funds for the cheques they
--   cover. It can edit a cheque's notes.
-- - It can't add anything (cheques, parties, bank accounts, replacements),
--   change anything else, delete, or import an export. Reading and exporting
--   always work, and settings stay writable.
--
-- How:
-- - The status functions mark their own transaction as a lifecycle change
--   (app.given_lifecycle here, app.received_lifecycle as migration 012 already
--   does). History rows and funds added are accepted with write access or
--   inside such a change.
-- - The plan-checking UPDATE policies on cheques and received_cheques are
--   replaced by a trigger that lets the Free plan change notes only. A blocked
--   update now says why, instead of quietly changing no rows.
-- - Inserts and deletes keep migration 011's policies, so nothing new can be
--   added without a plan.
-- - Importing an export needs a paid plan (a purchase or a grant); a free
--   trial isn't enough (plan item 84).
--
-- Jobs with no signed-in user (auto-pass, the companions, using the service
-- role) are never limited by plans. Each function body below is the latest
-- one, unchanged apart from the marked lines.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Whether this transaction is a status change made by one of the functions.
CREATE OR REPLACE FUNCTION internal.lifecycle_on()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT coalesce(current_setting('app.given_lifecycle', true), '') = 'on'
      OR coalesce(current_setting('app.received_lifecycle', true), '') = 'on';
$$;

-- For changes the Free plan can't make: a clear message instead of a
-- row-level security error.
CREATE OR REPLACE FUNCTION internal.require_write_access()
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_write_access() THEN
    RAISE EXCEPTION 'You''re on the Free plan. Upgrade to Business to make changes.' USING ERRCODE = '42501';
  END IF;
END;
$$;

-- A paid plan (a purchase or a grant from the operator) that hasn't ended,
-- or billing off. Trials don't count. Matches `paid` in src/lib/plan.ts.
CREATE OR REPLACE FUNCTION internal.has_paid_plan()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT NOT coalesce((SELECT billing_enabled FROM instance_config WHERE id), false)
      OR EXISTS (
        SELECT 1 FROM entitlements e
        WHERE e.user_id = auth.uid()
          AND e.source <> 'trial'
          AND (e.expires_at IS NULL OR e.expires_at > now())
      );
$$;

-- The Free plan may change a cheque's notes and nothing else, outside the
-- status functions.
CREATE OR REPLACE FUNCTION internal.free_plan_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR internal.lifecycle_on() OR public.has_write_access() THEN
    RETURN NEW;
  END IF;
  IF (to_jsonb(NEW) - 'notes' - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'notes' - 'updated_at') THEN
    RAISE EXCEPTION 'On the Free plan you can edit notes only. Upgrade to Business to change anything else.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION internal.lifecycle_on(), internal.require_write_access(), internal.has_paid_plan(),
  internal.free_plan_update_guard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION internal.lifecycle_on(), internal.require_write_access(), internal.has_paid_plan()
  TO authenticated, service_role;

CREATE TRIGGER cheques_free_plan_guard
  BEFORE UPDATE ON public.cheques
  FOR EACH ROW EXECUTE FUNCTION internal.free_plan_update_guard();

CREATE TRIGGER received_cheques_free_plan_guard
  BEFORE UPDATE ON public.received_cheques
  FOR EACH ROW EXECUTE FUNCTION internal.free_plan_update_guard();

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

-- Updates: the trigger above decides, so a blocked update says why.
DROP POLICY "Updates need an active plan" ON public.cheques;
DROP POLICY "Updates need an active plan" ON public.received_cheques;

-- History and funds added: with write access, or inside a status function.
ALTER POLICY "Inserts need an active plan" ON public.cheque_history
  WITH CHECK ((SELECT public.has_write_access()) OR (SELECT internal.lifecycle_on()));
ALTER POLICY "Inserts need an active plan" ON public.received_cheque_history
  WITH CHECK ((SELECT public.has_write_access()) OR (SELECT internal.lifecycle_on()));
ALTER POLICY "Inserts need an active plan" ON public.daily_deposits
  WITH CHECK ((SELECT public.has_write_access()) OR (SELECT internal.lifecycle_on()));

-- ---------------------------------------------------------------------------
-- The paid plan is called Business.
-- ---------------------------------------------------------------------------
ALTER TABLE public.entitlements ALTER COLUMN plan SET DEFAULT 'business';
UPDATE public.entitlements SET plan = 'business' WHERE plan = 'pro';

-- ---------------------------------------------------------------------------
-- change_cheque_status: as in migration 009, marked as a lifecycle change.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.change_cheque_status(
  p_cheque_id     uuid,
  p_new_status    text,
  p_changed_by    text DEFAULT 'manual',
  p_note          text DEFAULT NULL,
  p_return_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  c public.cheques;
BEGIN
  -- The Free plan can still move cheques along (finishing mode, see the top).
  PERFORM set_config('app.given_lifecycle', 'on', true);

  IF p_changed_by NOT IN ('manual', 'auto', 'deposit_allocation') THEN
    RAISE EXCEPTION 'Invalid changed_by: %', p_changed_by USING ERRCODE = '22023';
  END IF;

  SELECT * INTO c FROM cheques
  WHERE id = p_cheque_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cheque not found' USING ERRCODE = 'P0002';
  END IF;

  IF c.status = p_new_status THEN
    RETURN;
  END IF;

  -- Mirrors VALID_STATUS_TRANSITIONS in src/types/index.ts. Re-present and
  -- write-off have their own functions below.
  IF NOT (
       (c.status = 'PENDING'   AND p_new_status IN ('DEPOSITED', 'RETURNED', 'CANCELLED'))
    OR (c.status = 'DEPOSITED' AND p_new_status IN ('PASSED', 'RETURNED', 'CANCELLED'))
  ) THEN
    RAISE EXCEPTION 'Cannot change status from % to %', c.status, p_new_status
      USING ERRCODE = '22023';
  END IF;

  IF p_new_status = 'RETURNED' AND coalesce(btrim(p_return_reason), '') = '' THEN
    RAISE EXCEPTION 'A return reason is required' USING ERRCODE = '22023';
  END IF;

  UPDATE cheques
  SET status        = p_new_status,
      return_reason = CASE WHEN p_new_status = 'RETURNED' THEN btrim(p_return_reason) ELSE return_reason END,
      auto_transition_blocked = CASE
        WHEN p_new_status = 'DEPOSITED' THEN false
        WHEN p_changed_by = 'auto' THEN auto_transition_blocked
        ELSE true
      END
  WHERE id = p_cheque_id;

  -- clock_timestamp() so several changes in one transaction keep their order.
  INSERT INTO cheque_history (cheque_id, from_status, to_status, changed_by, note, prev_state, created_at)
  VALUES (p_cheque_id, c.status, p_new_status, p_changed_by, p_note, cheque_state_snapshot(c), clock_timestamp());
END;
$$;

-- ---------------------------------------------------------------------------
-- represent_cheque: as in migration 010, marked as a lifecycle change.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.represent_cheque(
  p_cheque_id      uuid,
  p_new_due_date   date,
  p_note           text DEFAULT NULL,
  p_mark_deposited boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  c public.cheques;
  v_note text;
BEGIN
  -- The Free plan can still move cheques along (finishing mode, see the top).
  PERFORM set_config('app.given_lifecycle', 'on', true);

  SELECT * INTO c FROM cheques
  WHERE id = p_cheque_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cheque not found' USING ERRCODE = 'P0002';
  END IF;
  IF c.status <> 'RETURNED' THEN
    RAISE EXCEPTION 'Only returned cheques can be re-presented' USING ERRCODE = '22023';
  END IF;
  IF is_legacy_represented(c) THEN
    RAISE EXCEPTION 'This cheque was already re-presented with the old flow' USING ERRCODE = '22023';
  END IF;
  IF p_new_due_date IS NULL THEN
    RAISE EXCEPTION 'A new due date is required' USING ERRCODE = '22023';
  END IF;

  UPDATE cheques
  SET status            = 'PENDING',
      original_due_date = coalesce(original_due_date, due_date),
      due_date          = p_new_due_date,
      represent_count   = represent_count + 1,
      auto_transition_blocked = false
  WHERE id = p_cheque_id;

  v_note := concat_ws(' · ',
    'Re-presented (was due ' || to_char(c.due_date, 'YYYY-MM-DD') || ')',
    CASE WHEN c.return_reason IS NOT NULL THEN 'Returned: ' || c.return_reason END,
    nullif(btrim(p_note), '')
  );

  INSERT INTO cheque_history (cheque_id, from_status, to_status, changed_by, note, prev_state, created_at)
  VALUES (p_cheque_id, 'RETURNED', 'PENDING', 'manual', v_note, cheque_state_snapshot(c), clock_timestamp());

  IF p_mark_deposited THEN
    PERFORM change_cheque_status(p_cheque_id, 'DEPOSITED', 'manual', 'Funded on re-presentation');
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- write_off_cheque: as in migration 009, marked as a lifecycle change.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.write_off_cheque(
  p_cheque_id uuid,
  p_reason    text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  c public.cheques;
BEGIN
  -- The Free plan can still move cheques along (finishing mode, see the top).
  PERFORM set_config('app.given_lifecycle', 'on', true);

  IF coalesce(btrim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'A write-off reason is required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO c FROM cheques
  WHERE id = p_cheque_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cheque not found' USING ERRCODE = 'P0002';
  END IF;
  IF c.status <> 'RETURNED' THEN
    RAISE EXCEPTION 'Only returned cheques can be written off' USING ERRCODE = '22023';
  END IF;
  IF is_legacy_represented(c) THEN
    RAISE EXCEPTION 'This cheque was already re-presented with the old flow' USING ERRCODE = '22023';
  END IF;

  UPDATE cheques
  SET status           = 'WRITTEN_OFF',
      write_off_reason = btrim(p_reason),
      auto_transition_blocked = true
  WHERE id = p_cheque_id;

  INSERT INTO cheque_history (cheque_id, from_status, to_status, changed_by, note, prev_state, created_at)
  VALUES (p_cheque_id, 'RETURNED', 'WRITTEN_OFF', 'manual', 'Written off: ' || btrim(p_reason), cheque_state_snapshot(c), clock_timestamp());
END;
$$;

-- ---------------------------------------------------------------------------
-- rollback_cheque_status: as in migration 016, marked as a lifecycle change.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rollback_cheque_status(
  p_cheque_id uuid,
  p_note      text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  c public.cheques;
  h public.cheque_history;
  s jsonb;
  v_target text;
BEGIN
  -- The Free plan can still move cheques along (finishing mode, see the top).
  PERFORM set_config('app.given_lifecycle', 'on', true);

  SELECT * INTO c FROM cheques
  WHERE id = p_cheque_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cheque not found' USING ERRCODE = 'P0002';
  END IF;
  IF is_legacy_represented(c) THEN
    RAISE EXCEPTION 'This cheque was re-presented with the old flow and cannot be rolled back' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO h
  FROM cheque_history ch
  WHERE ch.cheque_id = p_cheque_id
    AND ch.reverts_history_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM cheque_history r
      WHERE r.cheque_id = p_cheque_id AND r.reverts_history_id = ch.id
    )
  ORDER BY ch.created_at DESC, ch.id DESC
  LIMIT 1;

  IF NOT FOUND OR h.changed_by = 'import' THEN
    RAISE EXCEPTION 'There is no status change to roll back' USING ERRCODE = '22023';
  END IF;
  IF h.to_status <> c.status THEN
    RAISE EXCEPTION 'Cheque history is out of sync (last change was to %, cheque is %)', h.to_status, c.status
      USING ERRCODE = '22023';
  END IF;

  s := h.prev_state;
  v_target := h.from_status;

  IF s IS NOT NULL THEN
    UPDATE cheques
    SET status            = s->>'status',
        due_date          = (s->>'due_date')::date,
        original_due_date = (s->>'original_due_date')::date,
        return_reason     = s->>'return_reason',
        represent_count   = coalesce((s->>'represent_count')::int, 0),
        write_off_reason  = s->>'write_off_reason',
        -- A manual rollback keeps the auto-pass job from redoing the change.
        auto_transition_blocked = true
    WHERE id = p_cheque_id;
    v_target := s->>'status';
  ELSE
    UPDATE cheques
    SET status        = h.from_status,
        return_reason = CASE WHEN c.status = 'RETURNED' THEN NULL ELSE return_reason END,
        auto_transition_blocked = true
    WHERE id = p_cheque_id;
  END IF;

  INSERT INTO cheque_history (cheque_id, from_status, to_status, changed_by, note, prev_state, reverts_history_id, created_at)
  VALUES (
    p_cheque_id, c.status, v_target, 'rollback',
    concat_ws(' · ', 'Rolled back ' || h.from_status || ' → ' || h.to_status, nullif(btrim(p_note), '')),
    cheque_state_snapshot(c), h.id, clock_timestamp()
  );

  RETURN v_target;
END;
$$;

-- ---------------------------------------------------------------------------
-- record_deposit: as in migration 018, marked as a lifecycle change.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_deposit(
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
  -- On the Free plan, funds can only be added for the cheques they fund.
  IF auth.uid() IS NOT NULL AND NOT public.has_write_access() AND coalesce(cardinality(p_cheque_ids), 0) = 0 THEN
    RAISE EXCEPTION 'On the Free plan, funds can only be added for the cheques they cover. Tick at least one.'
      USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('app.given_lifecycle', 'on', true);

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

-- ---------------------------------------------------------------------------
-- internal.lock_received: as in migration 012, without the plan check.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION internal.lock_received(p_cheque_id uuid)
RETURNS public.received_cheques
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  c public.received_cheques;
BEGIN
  -- The Free plan can still move cheques along (finishing mode, see the top);
  -- row-level security still limits it to the user's own cheques.
  SELECT * INTO c FROM received_cheques
  WHERE id = p_cheque_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cheque not found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM set_config('app.received_lifecycle', 'on', true);
  RETURN c;
END;
$$;

-- ---------------------------------------------------------------------------
-- replace_received_cheque: as in migration 012, plus the plan check.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.replace_received_cheque(
  p_cheque_id     uuid,
  p_cheque_number text,
  p_bank_name     text,
  p_amount        numeric,
  p_cheque_date   date,
  p_received_on   date,
  p_due_date      date DEFAULT NULL,
  p_notes         text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  c        public.received_cheques;
  v_new_id uuid;
BEGIN
  -- A replacement is a new cheque, so it needs Business (or a trial).
  PERFORM internal.require_write_access();

  IF coalesce(btrim(p_cheque_number), '') = '' THEN
    RAISE EXCEPTION 'The new cheque number is required' USING ERRCODE = '22023';
  END IF;

  c := internal.lock_received(p_cheque_id);
  IF c.status NOT IN ('IN_HAND', 'BOUNCED') THEN
    RAISE EXCEPTION 'Only cheques in hand or bounced can be replaced' USING ERRCODE = '22023';
  END IF;

  INSERT INTO received_cheques (
    user_id, party_id, kind, cheque_number, bank_name, amount,
    received_on, cheque_date, due_date, deposit_account_id, replaces_id, notes
  )
  VALUES (
    c.user_id, c.party_id, c.kind, btrim(p_cheque_number), btrim(p_bank_name), p_amount,
    p_received_on, p_cheque_date, coalesce(p_due_date, p_cheque_date, c.due_date),
    c.deposit_account_id, c.id, nullif(btrim(p_notes), '')
  )
  RETURNING id INTO v_new_id;

  UPDATE received_cheques SET status = 'REPLACED' WHERE id = p_cheque_id;
  PERFORM internal.log_received(c, 'REPLACED', 'Replaced by cheque ' || btrim(p_cheque_number));

  RETURN v_new_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- import_data: as in migration 016, plus: only with a paid plan.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.import_data(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user     uuid := auth.uid();
  v_bad      text;
  v_parties  int;
  v_cheques  int;
  v_deposits int;
BEGIN
  IF v_user IS NOT NULL AND NOT internal.has_paid_plan() THEN
    RAISE EXCEPTION 'Importing an export comes with a Business plan.' USING ERRCODE = '42501';
  END IF;

  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sign in to import' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_data) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Nothing to import' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM parties WHERE user_id = v_user AND deleted_at IS NULL)
     OR EXISTS (SELECT 1 FROM cheques WHERE user_id = v_user AND deleted_at IS NULL)
     OR EXISTS (SELECT 1 FROM received_cheques WHERE user_id = v_user AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Import only works on an account with no parties or cheques yet' USING ERRCODE = '22023';
  END IF;

  -- Parties -----------------------------------------------------------------

  SELECT reason INTO v_bad FROM (
    SELECT CASE
      WHEN coalesce(btrim(x.name), '') = '' THEN 'A party has no name'
      WHEN count(*) OVER (PARTITION BY lower(btrim(x.name))) > 1 THEN format('The party %s appears more than once', btrim(x.name))
    END AS reason
    FROM jsonb_to_recordset(coalesce(p_data->'parties', '[]')) AS x(name text)
  ) checked
  WHERE reason IS NOT NULL
  LIMIT 1;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION '%', v_bad USING ERRCODE = '22023';
  END IF;

  INSERT INTO parties (user_id, name, contact_name, phone, bank_name, notes, is_active)
  SELECT v_user, btrim(x.name), nullif(btrim(x.contact_name), ''), nullif(btrim(x.phone), ''),
         nullif(btrim(x.bank_name), ''), nullif(btrim(x.notes), ''), coalesce(x.is_active, true)
  FROM jsonb_to_recordset(coalesce(p_data->'parties', '[]'))
    AS x(name text, contact_name text, phone text, bank_name text, notes text, is_active boolean);
  GET DIAGNOSTICS v_parties = ROW_COUNT;

  -- Given cheques -----------------------------------------------------------

  SELECT format('Cheque %s: %s', number, problem) INTO v_bad FROM (
    SELECT coalesce(nullif(btrim(c.cheque_number), ''), '(no number)') AS number, CASE
      WHEN coalesce(btrim(c.cheque_number), '') = '' THEN 'it has no number'
      WHEN coalesce(btrim(c.bank_name), '') = '' THEN 'it has no bank'
      WHEN c.amount IS NULL OR c.amount <= 0 THEN 'the amount must be more than zero'
      WHEN c.issue_date IS NULL OR c.due_date IS NULL THEN 'a date is missing'
      WHEN c.status IS NULL OR c.status NOT IN ('PENDING', 'DEPOSITED', 'PASSED', 'RETURNED', 'CANCELLED', 'WRITTEN_OFF')
        THEN format('unknown status %s', coalesce(c.status, '(none)'))
      WHEN coalesce(c.represent_count, 0) < 0 THEN 'times re-presented can''t be negative'
      WHEN NOT EXISTS (
        SELECT 1 FROM parties p
        WHERE p.user_id = v_user AND p.deleted_at IS NULL AND lower(p.name) = lower(btrim(c.party))
      ) THEN format('the party %s isn''t in the file', coalesce(nullif(btrim(c.party), ''), '(none)'))
    END AS problem
    FROM jsonb_to_recordset(coalesce(p_data->'cheques', '[]'))
      AS c(party text, cheque_number text, bank_name text, amount numeric, issue_date date, due_date date,
           status text, represent_count int)
  ) checked
  WHERE problem IS NOT NULL
  LIMIT 1;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION '%', v_bad USING ERRCODE = '22023';
  END IF;

  INSERT INTO cheques (user_id, party_id, cheque_number, bank_name, amount, issue_date, due_date, status,
                       original_due_date, represent_count, write_off_reason, notes)
  SELECT v_user, p.id, btrim(c.cheque_number), btrim(c.bank_name), c.amount, c.issue_date, c.due_date, c.status,
         c.original_due_date, coalesce(c.represent_count, 0), nullif(btrim(c.write_off_reason), ''),
         nullif(btrim(c.notes), '')
  FROM jsonb_to_recordset(coalesce(p_data->'cheques', '[]'))
    AS c(party text, cheque_number text, bank_name text, amount numeric, issue_date date, due_date date,
         status text, original_due_date date, represent_count int, write_off_reason text, notes text)
  JOIN parties p ON p.user_id = v_user AND p.deleted_at IS NULL AND lower(p.name) = lower(btrim(c.party));
  GET DIAGNOSTICS v_cheques = ROW_COUNT;

  -- The account had no active cheques, so every active cheque is a new one.
  INSERT INTO cheque_history (cheque_id, from_status, to_status, changed_by, note)
  SELECT id, status, status, 'import', 'Imported from an export'
  FROM cheques
  WHERE user_id = v_user AND deleted_at IS NULL;

  -- Funds added -------------------------------------------------------------

  SELECT reason INTO v_bad FROM (
    SELECT CASE
      WHEN d.deposit_date IS NULL THEN 'Funds added: a date is missing'
      WHEN d.amount IS NULL OR d.amount <= 0 THEN format('Funds added on %s: the amount must be more than zero', d.deposit_date)
    END AS reason
    FROM jsonb_to_recordset(coalesce(p_data->'deposits', '[]')) AS d(amount numeric, deposit_date date)
  ) checked
  WHERE reason IS NOT NULL
  LIMIT 1;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION '%', v_bad USING ERRCODE = '22023';
  END IF;

  INSERT INTO daily_deposits (user_id, amount, deposit_date, notes)
  SELECT v_user, d.amount, d.deposit_date, nullif(btrim(d.notes), '')
  FROM jsonb_to_recordset(coalesce(p_data->'deposits', '[]')) AS d(amount numeric, deposit_date date, notes text)
  WHERE NOT EXISTS (
    SELECT 1 FROM daily_deposits e
    WHERE e.user_id = v_user AND e.deposit_date = d.deposit_date AND e.amount = d.amount
      AND e.notes IS NOT DISTINCT FROM nullif(btrim(d.notes), '')
  );
  GET DIAGNOSTICS v_deposits = ROW_COUNT;

  RETURN jsonb_build_object('parties', v_parties, 'cheques', v_cheques, 'deposits', v_deposits);
END;
$$;
