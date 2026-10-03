-- 023: The demo (plan item 86)
--
-- Anyone can look around without signing up. "Try the demo" signs the visitor
-- in with Supabase's anonymous sign-in, which gives them a private account of
-- their own, and start_demo() fills it with made-up parties and cheques in
-- every state. Ending the demo (signing out) deletes the account and its rows,
-- and demos left open are deleted after a day. Visitors never share data.
--
-- An anonymous session is a real session with the authenticated role, so the
-- database keeps demos in bounds, not the app:
--
-- - An anonymous account can add or change data only during its one-day demo
--   grant (entitlements.source = 'demo'), even where billing is off and
--   everything else is free. Signing in anonymously without starting the demo
--   gives an empty account that can't add anything.
-- - start_demo() gives that grant once per anonymous account, and never to a
--   real one. Demos get no free trial (handle_new_user), can't import an export
--   (has_paid_plan) and can't buy a plan (the payments function).
-- - Each demo holds a limited number of rows, each of a limited size, so it
--   can't be used as free storage (internal.demo_limits).
-- - instance_config.demos_per_hour caps how many demos start in an hour across
--   the instance; 0 turns the demo off.
-- - Demos older than a day are deleted as new ones start, and every hour by a
--   pg_cron job where pg_cron is installed.
--
-- Supabase also rate-limits anonymous sign-ins per IP address, and once CAPTCHA
-- protection is on, each one needs a Turnstile token. See docs/editions.md.
--
-- If an anonymous account is turned into a real one through the API (the app
-- never does that), its demo grant stops counting, and it gets no trial.

-- ---------------------------------------------------------------------------
-- How many demos may start in an hour
-- ---------------------------------------------------------------------------
ALTER TABLE public.instance_config
  ADD COLUMN demos_per_hour integer NOT NULL DEFAULT 50 CHECK (demos_per_hour BETWEEN 0 AND 10000);

COMMENT ON COLUMN public.instance_config.demos_per_hour IS
  'Most demos that can start in an hour, across the instance. 0 turns the demo off. It also needs anonymous sign-ins on in Supabase.';

-- ---------------------------------------------------------------------------
-- The demo grant
-- ---------------------------------------------------------------------------
ALTER TABLE public.entitlements DROP CONSTRAINT entitlements_source_check;
ALTER TABLE public.entitlements ADD CONSTRAINT entitlements_source_check
  CHECK (source IN ('trial', 'purchase', 'comp', 'demo'));

COMMENT ON COLUMN public.entitlements.source IS
  'trial = free trial at sign-up; purchase = paid (payment_ref holds the provider id); comp = granted by the operator; demo = the one day of a demo account (start_demo).';

-- One demo grant per account, and a quick count of the latest ones.
CREATE UNIQUE INDEX entitlements_one_demo ON public.entitlements (user_id) WHERE source = 'demo';
CREATE INDEX entitlements_demo_started ON public.entitlements (created_at) WHERE source = 'demo';

-- ---------------------------------------------------------------------------
-- Whether the signed-in user is a demo (an anonymous sign-in), from their
-- token, which Supabase Auth signs.
-- ---------------------------------------------------------------------------
CREATE FUNCTION internal.is_anonymous()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
$$;

-- ---------------------------------------------------------------------------
-- has_write_access: as in migration 011, but a demo needs its demo grant
-- whatever the edition, and the demo grant counts for nobody else.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_write_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT CASE
    WHEN internal.is_anonymous() THEN EXISTS (
      SELECT 1
      FROM entitlements e
      WHERE e.user_id = auth.uid()
        AND e.source = 'demo'
        AND e.starts_at <= now()
        AND e.expires_at > now()
    )
    ELSE NOT coalesce((SELECT billing_enabled FROM instance_config WHERE id), false)
      OR EXISTS (
        SELECT 1
        FROM entitlements e
        WHERE e.user_id = auth.uid()
          AND e.source <> 'demo'
          AND e.starts_at <= now()
          AND (e.expires_at IS NULL OR e.expires_at > now())
      )
  END;
$$;

-- ---------------------------------------------------------------------------
-- has_paid_plan (importing an export): as in migration 019, but neither a
-- trial nor a demo counts, and a demo never imports.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION internal.has_paid_plan()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT NOT internal.is_anonymous()
     AND (NOT coalesce((SELECT billing_enabled FROM instance_config WHERE id), false)
          OR EXISTS (
            SELECT 1 FROM entitlements e
            WHERE e.user_id = auth.uid()
              AND e.source IN ('purchase', 'comp')
              AND (e.expires_at IS NULL OR e.expires_at > now())
          ));
$$;

-- ---------------------------------------------------------------------------
-- Sign-up: as in migration 021, but anonymous sign-ins (demos) get no trial
-- and no refusal; start_demo() gives them their day.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trial_days integer;
  v_refused    text;
BEGIN
  INSERT INTO public.settings (user_id) VALUES (NEW.id);

  -- Read through jsonb, so Auth versions without the column still sign up.
  IF coalesce((to_jsonb(NEW) ->> 'is_anonymous')::boolean, false) THEN
    RETURN NEW;
  END IF;

  SELECT CASE WHEN billing_enabled THEN trial_days ELSE 0 END
  INTO v_trial_days
  FROM public.instance_config
  WHERE id;

  IF coalesce(v_trial_days, 0) > 0 THEN
    v_refused := internal.claim_trial(NEW.email);
    IF v_refused IS NULL THEN
      INSERT INTO public.entitlements (user_id, source, expires_at, note)
      VALUES (NEW.id, 'trial', now() + make_interval(days => v_trial_days), 'Free trial');
    ELSE
      INSERT INTO public.trial_refusals (user_id, reason) VALUES (NEW.id, v_refused);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Limits for demos, so one can't be used as free storage: at most so many
-- rows in a table (deleted ones count), each at most 2 kB written out. The
-- trigger's argument is the number of rows; without one, only the size is
-- checked. Real accounts aren't limited.
-- ---------------------------------------------------------------------------
CREATE FUNCTION internal.demo_limits()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_max   integer := TG_ARGV[0]::integer;
  v_count integer;
BEGIN
  IF NOT internal.is_anonymous() THEN
    RETURN NEW;
  END IF;

  IF octet_length(NEW::text) > 2048 THEN
    RAISE EXCEPTION 'That''s more text than the demo keeps. Create an account to save it.' USING ERRCODE = '54000';
  END IF;

  IF TG_OP = 'INSERT' AND v_max IS NOT NULL THEN
    IF TG_TABLE_NAME = 'cheque_history' THEN
      SELECT count(*) INTO v_count FROM public.cheque_history h
      WHERE h.cheque_id IN (SELECT c.id FROM public.cheques c WHERE c.user_id = auth.uid());
    ELSIF TG_TABLE_NAME = 'received_cheque_history' THEN
      SELECT count(*) INTO v_count FROM public.received_cheque_history h
      WHERE h.cheque_id IN (SELECT c.id FROM public.received_cheques c WHERE c.user_id = auth.uid());
    ELSE
      EXECUTE format('SELECT count(*) FROM public.%I WHERE user_id = $1', TG_TABLE_NAME) INTO v_count USING auth.uid();
    END IF;
    IF v_count >= v_max THEN
      RAISE EXCEPTION 'The demo holds up to % of these. Create an account to add more.', v_max USING ERRCODE = '54000';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER demo_limits BEFORE INSERT OR UPDATE ON public.parties
  FOR EACH ROW EXECUTE FUNCTION internal.demo_limits('50');
CREATE TRIGGER demo_limits BEFORE INSERT OR UPDATE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION internal.demo_limits('5');
CREATE TRIGGER demo_limits BEFORE INSERT OR UPDATE ON public.cheques
  FOR EACH ROW EXECUTE FUNCTION internal.demo_limits('100');
CREATE TRIGGER demo_limits BEFORE INSERT OR UPDATE ON public.received_cheques
  FOR EACH ROW EXECUTE FUNCTION internal.demo_limits('100');
CREATE TRIGGER demo_limits BEFORE INSERT OR UPDATE ON public.daily_deposits
  FOR EACH ROW EXECUTE FUNCTION internal.demo_limits('30');
CREATE TRIGGER demo_limits BEFORE INSERT ON public.cheque_history
  FOR EACH ROW EXECUTE FUNCTION internal.demo_limits('300');
CREATE TRIGGER demo_limits BEFORE INSERT ON public.received_cheque_history
  FOR EACH ROW EXECUTE FUNCTION internal.demo_limits('300');
CREATE TRIGGER demo_limits BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION internal.demo_limits();

-- ---------------------------------------------------------------------------
-- Deleting a demo: its rows first (users' rows don't cascade, see plan item
-- 57), then the account, which takes its plan rows and sign-in sessions with
-- it. Only ever an anonymous account: false, and nothing deleted, otherwise.
-- ---------------------------------------------------------------------------
CREATE FUNCTION internal.remove_demo_account(p_user uuid)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user AND is_anonymous) THEN
    RETURN false;
  END IF;

  DELETE FROM cheque_history WHERE cheque_id IN (SELECT id FROM cheques WHERE user_id = p_user);
  DELETE FROM received_cheque_history WHERE cheque_id IN (SELECT id FROM received_cheques WHERE user_id = p_user);
  DELETE FROM cheques WHERE user_id = p_user;
  DELETE FROM received_cheques WHERE user_id = p_user;
  DELETE FROM daily_deposits WHERE user_id = p_user;
  DELETE FROM parties WHERE user_id = p_user;
  DELETE FROM bank_accounts WHERE user_id = p_user;
  DELETE FROM settings WHERE user_id = p_user;
  DELETE FROM auth.users WHERE id = p_user AND is_anonymous;
  RETURN true;
END;
$$;

-- Demos (and other anonymous sign-ins) more than a day old, oldest first.
-- Never the signed-in user's own, while they start their demo.
CREATE FUNCTION internal.remove_expired_demos(p_limit integer DEFAULT 1000)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_user    uuid;
  v_removed integer := 0;
BEGIN
  FOR v_user IN
    SELECT id FROM auth.users
    WHERE is_anonymous AND created_at < now() - interval '1 day' AND id IS DISTINCT FROM auth.uid()
    ORDER BY created_at
    LIMIT p_limit
  LOOP
    BEGIN
      IF internal.remove_demo_account(v_user) THEN
        v_removed := v_removed + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- One that can't be removed doesn't hold up the rest.
      RAISE WARNING 'Could not remove demo account %: %', v_user, SQLERRM;
    END;
  END LOOP;
  RETURN v_removed;
END;
$$;

-- ---------------------------------------------------------------------------
-- The made-up data a demo starts with (it was the sample set in
-- src/lib/sampleData.ts): every state Today and the lists show, dated around
-- the visitor's today. Status changes go through the same functions the app
-- uses, and their history is dated to the day each one happened.
-- ---------------------------------------------------------------------------

-- A moment on a day in the visitor's time zone, never later than now.
CREATE FUNCTION internal.demo_moment(p_day date, p_tz text)
RETURNS timestamptz
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT least((p_day + time '10:00') AT TIME ZONE p_tz, now());
$$;

CREATE FUNCTION internal.seed_demo(p_user uuid, p_today date, p_tz text, p_validity_months integer)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_party   jsonb;
  v_account uuid;
  v_id      uuid;
  v_on      date;
  v_series  uuid := gen_random_uuid();
  c         record;
  s         record;
BEGIN
  WITH added AS (
    INSERT INTO parties (user_id, name, is_active, created_at)
    SELECT p_user, name, true, internal.demo_moment(p_today - 60, p_tz)
    FROM unnest(ARRAY[
      'Sunrise Interiors', 'Harbor Logistics', 'Lakeview Clinic', 'Nimbus Print Works', 'Vega Packaging',
      'Orbit Engineering', 'Coastal Freight', 'Delta Traders', 'Pinewood Studio', 'Summit Tools',
      'Maple Catering', 'Skyline Properties', 'Greenfield Supplies', 'Bluebell Printers', 'Cedar Logistics'
    ]) AS name
    RETURNING id, name
  )
  SELECT jsonb_object_agg(name, id) INTO v_party FROM added;

  INSERT INTO bank_accounts (user_id, name, bank_name, last4, is_default, created_at)
  VALUES (p_user, 'Main account', 'Northwind Bank', '4021', true, internal.demo_moment(p_today - 60, p_tz))
  RETURNING id INTO v_account;

  -- Cheques you received. Days are counted from today; stale_in dates a cheque
  -- so it stops being valid that many days from now.
  FOR c IN
    SELECT * FROM (VALUES
      ('Sunrise Interiors',  '604518', 'Riverside Bank', 35000::numeric, 0, NULL::integer, 0, -4, '[]'::jsonb),
      ('Harbor Logistics',   '773131', 'Summit Bank',    25000,   0, NULL,   0,  -6, '[]'),
      ('Lakeview Clinic',    '220917', 'Lakeshore Bank', 15000,   0, NULL,   0,  -2, '[]'),
      ('Nimbus Print Works', '000912', 'Riverside Bank', 15000, NULL,   3,  -3, -20, '[]'),
      ('Vega Packaging',     '451207', 'Summit Bank',    20000, NULL,   6,   4, -30, '[]'),
      ('Orbit Engineering',  '118340', 'Lakeshore Bank', 40000,  10, NULL,  10,  -1, '[]'),
      ('Coastal Freight',    '000418', 'Summit Bank',    42000,  -8, NULL,  -6, -12,
        '[{"do": "deposit", "on": -6}, {"do": "bounce", "on": -3, "reason": "Funds insufficient", "charges": 354}]'),
      ('Delta Traders',      '773120', 'Riverside Bank', 60000,  -5, NULL,  -5,  -9, '[{"do": "deposit", "on": -5}]'),
      ('Delta Traders',      '773121', 'Riverside Bank', 38000,  -5, NULL,  -5,  -9, '[{"do": "deposit", "on": -5}]'),
      ('Pinewood Studio',    '309551', 'Lakeshore Bank', 73000,  -1, NULL,  -1,  -3, '[{"do": "deposit", "on": -1}]'),
      ('Summit Tools',       '812004', 'Summit Bank',    31500, -20, NULL, -20, -25,
        '[{"do": "deposit", "on": -20}, {"do": "clear", "on": -18}]'),
      ('Maple Catering',     '560073', 'Riverside Bank', 12000, -10, NULL, -10, -14,
        '[{"do": "settle", "on": -8, "via": "TRANSFER", "reference": "TRF-20418"}]')
    ) AS v(party, number, bank, amount, cheque_day, stale_in, due_day, received_day, steps)
  LOOP
    INSERT INTO received_cheques (user_id, party_id, cheque_number, bank_name, amount, received_on, cheque_date,
                                  due_date, deposit_account_id, created_at)
    VALUES (
      p_user, (v_party ->> c.party)::uuid, c.number, c.bank, c.amount, p_today + c.received_day,
      CASE WHEN c.stale_in IS NULL THEN p_today + c.cheque_day
           ELSE (p_today + c.stale_in - make_interval(months => p_validity_months))::date END,
      p_today + c.due_day, v_account, internal.demo_moment(p_today + c.received_day, p_tz)
    )
    RETURNING id INTO v_id;

    FOR s IN SELECT value FROM jsonb_array_elements(c.steps) LOOP
      v_on := p_today + (s.value ->> 'on')::integer;
      CASE s.value ->> 'do'
        WHEN 'deposit' THEN PERFORM public.deposit_received_cheques(ARRAY[v_id], v_on, v_account);
        WHEN 'clear' THEN PERFORM public.clear_received_cheques(ARRAY[v_id], v_on);
        WHEN 'bounce' THEN
          PERFORM public.bounce_received_cheque(v_id, v_on, s.value ->> 'reason', (s.value ->> 'charges')::numeric);
        WHEN 'settle' THEN
          PERFORM public.settle_received_cheque(v_id, s.value ->> 'via', v_on, s.value ->> 'reference');
      END CASE;
      UPDATE received_cheque_history SET created_at = internal.demo_moment(v_on, p_tz)
      WHERE id = (SELECT id FROM received_cheque_history WHERE cheque_id = v_id ORDER BY created_at DESC LIMIT 1);
    END LOOP;
  END LOOP;

  -- A security cheque for a lease, and the monthly rent from the first of next month.
  INSERT INTO received_cheques (user_id, party_id, kind, cheque_number, bank_name, amount, received_on, cheque_date,
                                due_date, deposit_account_id, notes, created_at)
  VALUES (p_user, (v_party ->> 'Skyline Properties')::uuid, 'SECURITY', '118000', 'Northwind Bank', NULL, p_today - 60,
          NULL, p_today + 4, v_account, 'Security for the office lease.', internal.demo_moment(p_today - 60, p_tz));

  INSERT INTO received_cheques (user_id, party_id, cheque_number, bank_name, amount, received_on, cheque_date,
                                due_date, deposit_account_id, series_id, series_index, created_at)
  SELECT p_user, (v_party ->> 'Skyline Properties')::uuid, (118000 + i)::text, 'Northwind Bank', 25000, p_today,
         (date_trunc('month', p_today::timestamp) + make_interval(months => i))::date,
         (date_trunc('month', p_today::timestamp) + make_interval(months => i))::date,
         v_account, v_series, i, internal.demo_moment(p_today, p_tz)
  FROM generate_series(1, 6) AS i;

  -- Cheques you gave, from the demo's account: one due today that needs funds,
  -- one funded today with Add funds, one passed and one returned.
  FOR c IN
    SELECT * FROM (VALUES
      ('Greenfield Supplies', '310201', 18000::numeric, -15,  0, '[]'::jsonb),
      ('Bluebell Printers',   '310202', 12500,          -12,  3, '[]'),
      ('Cedar Logistics',     '310203', 24000,          -10,  1, '[{"to": "FUNDS", "on": 0}]'),
      ('Greenfield Supplies', '310198',  9500,          -30, -7, '[{"to": "DEPOSITED", "on": -8}, {"to": "PASSED", "on": -7}]'),
      ('Bluebell Printers',   '310199', 27000,          -25, -4,
        '[{"to": "DEPOSITED", "on": -5}, {"to": "RETURNED", "on": -3, "reason": "Signature differs"}]')
    ) AS v(party, number, amount, issued_day, due_day, steps)
  LOOP
    INSERT INTO cheques (user_id, party_id, cheque_number, bank_name, bank_account_id, amount, issue_date, due_date,
                         status, created_at)
    VALUES (p_user, (v_party ->> c.party)::uuid, c.number, 'Northwind Bank', v_account, c.amount, p_today + c.issued_day,
            p_today + c.due_day, 'PENDING', internal.demo_moment(p_today + c.issued_day, p_tz))
    RETURNING id INTO v_id;

    FOR s IN SELECT value FROM jsonb_array_elements(c.steps) LOOP
      v_on := p_today + (s.value ->> 'on')::integer;
      IF s.value ->> 'to' = 'FUNDS' THEN
        PERFORM public.record_deposit(c.amount, v_on, ARRAY[v_id], NULL, v_account);
      ELSE
        PERFORM public.change_cheque_status(v_id, s.value ->> 'to', 'manual', NULL, s.value ->> 'reason');
      END IF;
      UPDATE cheque_history SET created_at = internal.demo_moment(v_on, p_tz)
      WHERE id = (SELECT id FROM cheque_history WHERE cheque_id = v_id ORDER BY created_at DESC LIMIT 1);
    END LOOP;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- Starting and ending a demo. The public functions are what the app calls;
-- the work happens in these, which can delete and grant.
-- ---------------------------------------------------------------------------

-- p_region: the settings columns of the region the app suggests for the
-- visitor (regionToSettings in src/lib/region.ts).
CREATE FUNCTION internal.start_demo(p_region jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user     uuid := auth.uid();
  v_per_hour integer;
  r          public.settings;
  v_today    date;
BEGIN
  IF v_user IS NULL OR NOT internal.is_anonymous()
     OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_user AND is_anonymous) THEN
    RAISE EXCEPTION 'Only a demo session can start the demo.' USING ERRCODE = '42501';
  END IF;

  -- One at a time, so the hourly limit holds.
  PERFORM pg_advisory_xact_lock(hashtext('internal.start_demo'));

  SELECT demos_per_hour INTO v_per_hour FROM instance_config WHERE id;
  IF coalesce(v_per_hour, 0) = 0 THEN
    RAISE EXCEPTION 'The demo is turned off here.' USING ERRCODE = '55000';
  END IF;
  IF EXISTS (SELECT 1 FROM entitlements WHERE user_id = v_user AND source = 'demo') THEN
    RAISE EXCEPTION 'This demo has already started.' USING ERRCODE = '55000';
  END IF;
  IF (SELECT count(*) FROM entitlements WHERE source = 'demo' AND created_at > now() - interval '1 hour') >= v_per_hour THEN
    RAISE EXCEPTION 'The demo is busy right now. Try again in a few minutes, or create an account.' USING ERRCODE = '54000';
  END IF;

  -- Demos left open more than a day go as new ones start.
  PERFORM internal.remove_expired_demos(20);

  r := jsonb_populate_record(NULL::public.settings, coalesce(p_region, '{}'::jsonb));
  IF r.country_code IS NULL OR r.currency_code IS NULL OR r.timezone IS NULL OR r.cheque_validity_months IS NULL THEN
    RAISE EXCEPTION 'The demo needs a region' USING ERRCODE = '22023';
  END IF;
  BEGIN
    v_today := (now() AT TIME ZONE r.timezone)::date;
  EXCEPTION WHEN invalid_parameter_value THEN
    RAISE EXCEPTION 'Unknown time zone: %', r.timezone USING ERRCODE = '22023';
  END;

  UPDATE settings
  SET country_code           = r.country_code,
      currency_code          = r.currency_code,
      currency_symbol        = r.currency_symbol,
      locale                 = r.locale,
      timezone               = r.timezone,
      date_format            = r.date_format,
      week_starts_on         = r.week_starts_on,
      cheque_validity_months = r.cheque_validity_months,
      clearing_days          = r.clearing_days,
      tracks                 = 'both'
  WHERE user_id = v_user;

  INSERT INTO entitlements (user_id, plan, source, starts_at, expires_at, note)
  VALUES (v_user, 'business', 'demo', now(), now() + interval '1 day', 'Demo');

  PERFORM internal.seed_demo(v_user, v_today, r.timezone, r.cheque_validity_months);
END;
$$;

CREATE FUNCTION internal.end_demo()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT internal.remove_demo_account(auth.uid()) THEN
    RAISE EXCEPTION 'Only a demo account can be ended this way.' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE FUNCTION public.start_demo(p_region jsonb)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT internal.start_demo(p_region);
$$;

CREATE FUNCTION public.end_demo()
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT internal.end_demo();
$$;

COMMENT ON FUNCTION public.start_demo(jsonb) IS
  'Fills a new anonymous account with the demo, in the given region (settings columns), and gives it one day. Once per account.';
COMMENT ON FUNCTION public.end_demo() IS
  'Deletes the signed-in demo account and everything in it. Only for anonymous accounts.';

REVOKE ALL ON FUNCTION internal.is_anonymous(), internal.demo_limits(), internal.remove_demo_account(uuid),
  internal.remove_expired_demos(integer), internal.demo_moment(date, text),
  internal.seed_demo(uuid, date, text, integer), internal.start_demo(jsonb), internal.end_demo(),
  public.start_demo(jsonb), public.end_demo()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION internal.is_anonymous() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION internal.start_demo(jsonb), internal.end_demo(), public.start_demo(jsonb), public.end_demo()
  TO authenticated;

-- ---------------------------------------------------------------------------
-- Every hour, delete demos more than a day old, where pg_cron is installed
-- (Supabase has it). Elsewhere they still go as new demos start.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('remove-expired-demos', '23 * * * *', 'SELECT internal.remove_expired_demos()');
  END IF;
END;
$$;
