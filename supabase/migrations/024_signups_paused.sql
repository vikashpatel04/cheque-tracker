-- =============================================================================
-- 024: Pausing sign-ups while the demo stays open (2026-10-17)
-- =============================================================================
-- Supabase's own "Allow new users to sign up" switch also stops anonymous
-- sign-ins, which are the demo (migration 023). So an instance pauses sign-ups
-- here instead. With instance_config.signups_open false:
-- - Auth can't create a new account, by email, Google or any other way;
-- - a demo can't be turned into an account;
-- - anonymous sign-ins (the demo) and existing accounts carry on as before.
-- The app reads the same column to show sign-ups as coming soon.
-- Self-hosted copies keep sign-ups open unless they choose otherwise.
-- =============================================================================

ALTER TABLE public.instance_config
  ADD COLUMN signups_open boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.instance_config.signups_open IS
  'false pauses sign-ups: no new accounts, and no demo turned into one. Anonymous sign-ins (the demo) still work.';

-- Runs as its owner: Auth's own database role can't read public tables.
CREATE FUNCTION internal.guard_signups()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- A demo, or an account that already exists, is never stopped.
  IF NEW.is_anonymous OR (TG_OP = 'UPDATE' AND NOT OLD.is_anonymous) THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.instance_config WHERE NOT signups_open) THEN
    RAISE EXCEPTION 'Sign-ups are paused' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION internal.guard_signups() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER guard_signups
  BEFORE INSERT OR UPDATE OF is_anonymous ON auth.users
  FOR EACH ROW EXECUTE FUNCTION internal.guard_signups();
