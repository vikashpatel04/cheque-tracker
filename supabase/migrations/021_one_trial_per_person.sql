-- 021: One free trial per person
--
-- On instances with billing on, a free trial at sign-up was easy to get again
-- and again with a new address. Now:
--
-- - Each email address gets one trial, ever. A hash of the address is kept in
--   internal.trial_claims, even after the account is deleted. Addresses are
--   compared the way mail is delivered: case doesn't matter, "+anything"
--   before the @ is dropped, and for Gmail so are dots (a.b+x@gmail.com is
--   ab@gmail.com).
-- - Addresses at throwaway-mail services (internal.throwaway_email_domains)
--   get no trial.
--
-- Such accounts still open, and can buy a pack straight away; nothing blocks
-- the sign-up itself. public.trial_refusals says why there was no trial, so
-- the app can explain. See docs/editions.md.
--
-- Only a hash of the address is kept, never the address. The privacy policy
-- (plan item 57) says so.

-- ---------------------------------------------------------------------------
-- Comparing addresses
-- ---------------------------------------------------------------------------
CREATE FUNCTION internal.normalized_email(p_email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  WITH address AS (
    SELECT split_part(e, '@', 1) AS local_part,
           CASE WHEN split_part(e, '@', 2) = 'googlemail.com' THEN 'gmail.com' ELSE split_part(e, '@', 2) END AS domain
    FROM (SELECT lower(btrim(p_email)) AS e) given
    WHERE p_email LIKE '%_@_%'
  ), mailbox AS (
    SELECT CASE WHEN domain = 'gmail.com' THEN replace(split_part(local_part, '+', 1), '.', '')
                ELSE split_part(local_part, '+', 1) END AS local_part,
           domain
    FROM address
  )
  SELECT local_part || '@' || domain FROM mailbox WHERE local_part <> '' AND domain <> '';
$$;

COMMENT ON FUNCTION internal.normalized_email(text) IS
  'The mailbox an address reaches: lower case, no +tag, and no dots for Gmail. Null if it isn''t an address.';

CREATE FUNCTION internal.email_hash(p_email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT encode(sha256(convert_to(internal.normalized_email(p_email), 'UTF8')), 'hex');
$$;

-- ---------------------------------------------------------------------------
-- Throwaway-mail services. A starter list of well-known ones; operators can
-- add the full public list (docs/editions.md). Not exposed through the API.
-- ---------------------------------------------------------------------------
CREATE TABLE internal.throwaway_email_domains (
  domain text PRIMARY KEY CHECK (domain ~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$')
);

ALTER TABLE internal.throwaway_email_domains ENABLE ROW LEVEL SECURITY;

INSERT INTO internal.throwaway_email_domains (domain) VALUES
  ('10minutemail.com'), ('10minutemail.net'), ('1secmail.com'), ('1secmail.net'), ('1secmail.org'),
  ('anonbox.net'), ('bccto.me'), ('byom.de'), ('chacuo.net'), ('discard.email'),
  ('dispostable.com'), ('dropmail.me'), ('emailfake.com'), ('emailondeck.com'), ('fakeinbox.com'),
  ('getairmail.com'), ('getnada.com'), ('grr.la'), ('guerrillamail.biz'), ('guerrillamail.com'),
  ('guerrillamail.de'), ('guerrillamail.info'), ('guerrillamail.net'), ('guerrillamail.org'), ('guerrillamailblock.com'),
  ('harakirimail.com'), ('inboxkitten.com'), ('jetable.org'), ('linshiyouxiang.net'), ('mailcatch.com'),
  ('maildrop.cc'), ('mailforspam.com'), ('mailinator.com'), ('mailmetrash.com'), ('mailnesia.com'),
  ('mailpoof.com'), ('mailsac.com'), ('mintemail.com'), ('moakt.com'), ('mohmal.com'),
  ('mytemp.email'), ('pokemail.net'), ('sharklasers.com'), ('spam4.me'), ('spambox.us'),
  ('spamgourmet.com'), ('tempail.com'), ('temp-mail.io'), ('temp-mail.org'), ('tempinbox.com'),
  ('tempmailaddress.com'), ('tempmailo.com'), ('tempr.email'), ('throwawaymail.com'), ('tmpmail.net'),
  ('tmpmail.org'), ('trash-mail.com'), ('trashmail.com'), ('trashmail.de'), ('trashmail.me'),
  ('trashmail.net'), ('wegwerfmail.de'), ('wegwerfmail.net'), ('wegwerfmail.org'), ('yopmail.com'),
  ('yopmail.fr'), ('yopmail.net');

-- Whether an address is at a throwaway-mail service, or one of its subdomains.
CREATE FUNCTION internal.is_throwaway_email(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM internal.throwaway_email_domains d
    WHERE split_part(p_email, '@', 2) = d.domain
       OR split_part(p_email, '@', 2) LIKE '%.' || d.domain
  );
$$;

-- ---------------------------------------------------------------------------
-- Trials given, by address. No user id, so it outlives deleted accounts.
-- ---------------------------------------------------------------------------
CREATE TABLE internal.trial_claims (
  email_hash text PRIMARY KEY CHECK (email_hash ~ '^[0-9a-f]{64}$'),
  claimed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE internal.trial_claims ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE internal.trial_claims IS
  'One row per email address (as a hash) that has had a free trial. Delete a row to allow that address another trial.';

-- Claims the trial for an address. Null when the trial is given; otherwise
-- why not: 'no_email', 'throwaway' or 'used'.
CREATE FUNCTION internal.claim_trial(p_email text)
RETURNS text
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_email text := internal.normalized_email(p_email);
BEGIN
  IF v_email IS NULL THEN
    RETURN 'no_email';
  END IF;
  IF internal.is_throwaway_email(v_email) THEN
    RETURN 'throwaway';
  END IF;
  INSERT INTO internal.trial_claims (email_hash) VALUES (internal.email_hash(v_email))
  ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN
    RETURN 'used';
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION internal.normalized_email(text), internal.email_hash(text),
  internal.is_throwaway_email(text), internal.claim_trial(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE internal.throwaway_email_domains, internal.trial_claims FROM PUBLIC, anon, authenticated;

-- Addresses that already had a trial count as used.
INSERT INTO internal.trial_claims (email_hash)
SELECT DISTINCT internal.email_hash(u.email)
FROM auth.users u
WHERE internal.normalized_email(u.email) IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.entitlements e WHERE e.user_id = u.id AND e.source = 'trial')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Why an account got no trial, for the app to explain. Users read their own.
-- ---------------------------------------------------------------------------
CREATE TABLE public.trial_refusals (
  user_id    uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  reason     text NOT NULL CHECK (reason IN ('used', 'throwaway', 'no_email')),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.trial_refusals IS
  'Accounts that got no free trial at sign-up, and why: the address had one before (used), is at a throwaway-mail service, or there was no address.';

ALTER TABLE public.trial_refusals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read why they got no trial"
ON public.trial_refusals FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);

REVOKE ALL ON TABLE public.trial_refusals FROM anon, authenticated;
GRANT SELECT ON TABLE public.trial_refusals TO authenticated;
GRANT ALL ON TABLE public.trial_refusals TO service_role;

-- ---------------------------------------------------------------------------
-- Sign-up: as in migration 011, but the trial is claimed by address first.
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
