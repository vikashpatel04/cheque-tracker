-- 019: Say "Your plan has ended" when a read-only account changes a given cheque
--
-- Plan item 55. The given-side functions lock the cheque with SELECT ... FOR
-- UPDATE. For an account without an active plan, row-level security (migration
-- 011) hides the row from that lock, so the functions said "Cheque not found".
-- record_deposit failed on its insert with a row-level security error instead.
--
-- Each function now checks first, like the received side does in
-- internal.lock_received (migration 012). The check is skipped when there's no
-- signed-in user, so the auto-pass job and companions using the service role
-- aren't limited by plans.
--
-- Only the check is new: each body below is the latest one, unchanged after it.
-- CREATE OR REPLACE keeps the existing grants.

CREATE OR REPLACE FUNCTION internal.require_write_access()
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_write_access() THEN
    RAISE EXCEPTION 'Your plan has ended. Renew it to make changes.' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION internal.require_write_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION internal.require_write_access() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- change_cheque_status: as in migration 009, plus the check.
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
  PERFORM internal.require_write_access();

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
-- represent_cheque: as in migration 010, plus the check.
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
  PERFORM internal.require_write_access();

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
-- write_off_cheque: as in migration 009, plus the check.
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
  PERFORM internal.require_write_access();

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
-- rollback_cheque_status: as in migration 016, plus the check.
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
  PERFORM internal.require_write_access();

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
-- record_deposit: as in migration 018, plus the check.
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
  PERFORM internal.require_write_access();

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
