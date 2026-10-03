-- 020: Buying packs (plan item 53)
--
-- The hosted service sells prepaid packs: a number of months of access, paid
-- once. See docs/editions.md and docs/payments.md.
--
-- - packs: what's for sale. The rows are the operator's business: add them in
--   the SQL editor of the hosted project, never in a migration, so prices stay
--   out of this public repository. Self-hosted instances have none.
-- - payment_orders: one row per checkout started, written only by the
--   `payments` Edge Function (service role).
-- - record_payment(): the one way a payment becomes a plan. The Edge Function
--   calls it after checking the payment with the provider. It can safely run
--   twice for the same payment (the browser and the provider's webhook both
--   report it), and a new pack starts when the access you already have ends,
--   so buying early loses nothing.

-- ---------------------------------------------------------------------------
-- packs
-- ---------------------------------------------------------------------------
CREATE TABLE public.packs (
  id          text PRIMARY KEY CHECK (id ~ '^[a-z0-9-]{1,32}$'),
  name        text NOT NULL CHECK (btrim(name) <> ''),
  months      integer NOT NULL CHECK (months BETWEEN 1 AND 60),
  currency    text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  -- In the currency's smallest unit (paise for INR, cents for USD), before tax.
  amount      bigint NOT NULL CHECK (amount > 0),
  tax_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK (tax_percent >= 0 AND tax_percent < 100),
  tax_name    text,
  tax_amount  bigint GENERATED ALWAYS AS (round(amount * tax_percent / 100)::bigint) STORED,
  total       bigint GENERATED ALWAYS AS (amount + round(amount * tax_percent / 100)::bigint) STORED,
  active      boolean NOT NULL DEFAULT true,
  sort        integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT packs_tax_named CHECK (tax_percent = 0 OR tax_name IS NOT NULL)
);

COMMENT ON TABLE public.packs IS
  'What the hosted service sells. Rows are added by the operator in the SQL editor, never in a migration.';
COMMENT ON COLUMN public.packs.amount IS
  'Price before tax, in the currency''s smallest unit (e.g. paise).';
COMMENT ON COLUMN public.packs.total IS
  'What the buyer pays: amount plus tax, in the smallest unit.';

ALTER TABLE public.packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can see packs on sale"
ON public.packs FOR SELECT TO authenticated
USING (active);

-- ---------------------------------------------------------------------------
-- payment_orders
-- ---------------------------------------------------------------------------
CREATE TABLE public.payment_orders (
  -- The payment provider's order id.
  id             text PRIMARY KEY,
  user_id        uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  pack_id        text NOT NULL REFERENCES public.packs,
  -- What was bought, kept as it was then, even if the pack changes later.
  pack_name      text NOT NULL,
  months         integer NOT NULL CHECK (months BETWEEN 1 AND 60),
  currency       text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  amount         bigint NOT NULL CHECK (amount > 0),
  tax_amount     bigint NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  status         text NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'paid')),
  payment_id     text UNIQUE,
  entitlement_id uuid REFERENCES public.entitlements ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  paid_at        timestamptz,
  CONSTRAINT payment_orders_paid CHECK (status = 'created' OR (payment_id IS NOT NULL AND paid_at IS NOT NULL))
);

COMMENT ON TABLE public.payment_orders IS
  'One row per checkout started. Written only by the payments Edge Function.';
COMMENT ON COLUMN public.payment_orders.amount IS
  'Total charged, tax included, in the currency''s smallest unit.';

CREATE INDEX idx_payment_orders_user ON public.payment_orders (user_id, created_at DESC);
CREATE INDEX idx_payment_orders_pack ON public.payment_orders (pack_id);
CREATE INDEX idx_payment_orders_entitlement ON public.payment_orders (entitlement_id);

ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own payments"
ON public.payment_orders FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);

-- A payment grants one plan, however many times it's reported.
CREATE UNIQUE INDEX entitlements_payment_ref ON public.entitlements (payment_ref) WHERE payment_ref IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Privileges (see migration 013): users only read; the service role writes.
-- ---------------------------------------------------------------------------
REVOKE ALL ON TABLE public.packs, public.payment_orders FROM anon, authenticated;
GRANT SELECT ON TABLE public.packs, public.payment_orders TO authenticated;
GRANT ALL ON TABLE public.packs, public.payment_orders TO service_role;

-- ---------------------------------------------------------------------------
-- record_payment: turn a checked payment into a plan. Service role only.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.record_payment(p_order_id text, p_payment_id text)
RETURNS public.entitlements
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  o public.payment_orders;
  e public.entitlements;
  v_start timestamptz;
BEGIN
  IF coalesce(btrim(p_payment_id), '') = '' THEN
    RAISE EXCEPTION 'A payment id is required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO o FROM payment_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown order %', p_order_id USING ERRCODE = 'P0002';
  END IF;

  -- Already recorded: the browser and the webhook both report each payment.
  IF o.status = 'paid' THEN
    IF o.payment_id IS DISTINCT FROM p_payment_id THEN
      RAISE EXCEPTION 'Order % was paid with another payment', p_order_id USING ERRCODE = '22023';
    END IF;
    SELECT * INTO e FROM entitlements WHERE id = o.entitlement_id;
    RETURN e;
  END IF;

  -- One purchase at a time per user, so two packs bought together follow each other.
  PERFORM pg_advisory_xact_lock(hashtext('record_payment:' || o.user_id::text));

  -- Start when the access the user already has ends (a trial or packs bought
  -- earlier), or now. A grant that never ends doesn't delay it, and neither
  -- does a demo's day (migration 023).
  SELECT greatest(now(), coalesce(max(expires_at), now())) INTO v_start
  FROM entitlements
  WHERE user_id = o.user_id AND expires_at > now() AND source <> 'demo';

  INSERT INTO entitlements (user_id, source, starts_at, expires_at, payment_ref, note)
  VALUES (o.user_id, 'purchase', v_start, v_start + make_interval(months => o.months), p_payment_id, o.pack_name)
  RETURNING * INTO e;

  UPDATE payment_orders
  SET status = 'paid', payment_id = p_payment_id, entitlement_id = e.id, paid_at = now()
  WHERE id = o.id;

  RETURN e;
END;
$$;

REVOKE ALL ON FUNCTION public.record_payment(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_payment(text, text) TO service_role;
