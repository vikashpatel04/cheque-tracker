-- 017: What you track
--
-- Whether someone gives cheques, receives them, or both. It only picks the
-- view Today and Cheques open on, and which half the menus offer. It never
-- limits the account or hides data: every view stays one tap away, and
-- changing it back shows everything as before. Existing accounts keep both.
--
-- Additive: companions that read `settings` are unaffected.

ALTER TABLE public.settings
  ADD COLUMN tracks text NOT NULL DEFAULT 'both',
  ADD CONSTRAINT settings_tracks_allowed CHECK (tracks IN ('given', 'received', 'both'));

COMMENT ON COLUMN public.settings.tracks IS
  'What the user tracks: given, received or both. Only the default view; it never limits data.';
