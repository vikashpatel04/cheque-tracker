-- 022: Remember the short tour of the app (plan item 85)
--
-- The tour shows once, after an account's first cheque. Finishing or skipping
-- it sets tour_done_at; "Show me around again" on the Learn page replays it.
-- Settings stay writable on the Free plan (migration 019), so this does too.

ALTER TABLE public.settings ADD COLUMN tour_done_at timestamptz;

COMMENT ON COLUMN public.settings.tour_done_at IS
  'When the user finished or skipped the tour of the app. Null: it starts after their first cheque.';

-- Accounts that already have cheques have found their way around, so the
-- tour doesn't interrupt them.
UPDATE public.settings s
SET tour_done_at = now()
WHERE EXISTS (SELECT 1 FROM public.cheques c WHERE c.user_id = s.user_id)
   OR EXISTS (SELECT 1 FROM public.received_cheques r WHERE r.user_id = s.user_id);
