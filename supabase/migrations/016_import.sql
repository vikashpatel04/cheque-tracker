-- Import from a Cheque Tracker export.
--
-- import_data() brings in parties, given cheques and funds added in one
-- transaction, so either everything is saved or nothing is. The app reads the
-- export file and sends plain JSON. This function checks every value itself,
-- because the given-side tables have no CHECK constraints.
--
-- It runs as the signed-in user, so row-level security applies: every row
-- belongs to auth.uid(), and a read-only account can't import. It only works
-- on an account with no active parties or cheques, so an import can't
-- duplicate them. Funds added can't be deleted, so any that match one already
-- there (same date, amount and notes) are skipped instead; that covers
-- importing again after Delete All Data.
--
-- Each cheque gets one history entry with changed_by = 'import'. There's no
-- earlier state to go back to, so rollback_cheque_status() now refuses to undo
-- it.

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

REVOKE ALL ON FUNCTION public.import_data(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_data(jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- rollback_cheque_status: as in migration 009, but an import can't be undone.
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
