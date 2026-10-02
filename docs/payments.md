# Payments: selling Business with Razorpay

Only for the hosted edition. On a self-hosted copy billing is off, so none of this shows; see [editions.md](./editions.md).

The paid plan is **Business**, bought for a number of months and paid once. It doesn't renew by itself. Each length on sale (1, 6 or 12 months) is a row in the `packs` table. A new period starts when the access you already have ends, whether that's a free trial or time bought earlier, so buying early loses nothing. When it ends, the account is on the Free plan ([editions.md](./editions.md)).

## How a payment works

1. In Settings → Plan, the user picks how long to buy Business for. The app calls the `payments` Edge Function's `/checkout`. It creates a Razorpay order for that length's price, tax included, and saves it in `payment_orders`.
2. The app opens Razorpay Checkout, loaded from `checkout.razorpay.com` only at this point, and the user pays.
3. The app sends the payment to `/confirm`. The function then:
   - checks Checkout's signature with the key secret;
   - fetches the payment from Razorpay, and captures it if it's only authorised;
   - calls `record_payment()`, which adds a `purchase` entitlement.
4. Razorpay also sends an `order.paid` webhook to `/webhook`, signed with the webhook secret. If the browser never got to step 3, because the tab closed or the network dropped, the webhook records the payment instead.
5. `record_payment()` gives one plan per payment, however many times it's reported. Only the service role can run it.

The prices are never in this repository. They live in the `packs` table of the hosted project, and the operator adds them there.

## Setting it up

1. **Razorpay.** Create an account and use its **test mode** first. Under Account & Settings → API keys, generate a key pair. Live keys come after Razorpay activates the account.
2. **Lengths and prices.** Add one `packs` row per length in the SQL editor of the hosted project. Amounts are in paise: ₹1 is 100. Set `tax_percent` and `tax_name` if you charge tax, and leave them out if you don't. The buyer pays `amount` plus the tax, and Settings shows both.

   ```sql
   insert into packs (id, name, months, currency, amount, tax_percent, tax_name, sort) values
     ('1m',  '1 month',   1,  'INR', <price in paise>, <tax %>, 'GST', 1),
     ('6m',  '6 months',  6,  'INR', <price in paise>, <tax %>, 'GST', 2),
     ('12m', '12 months', 12, 'INR', <price in paise>, <tax %>, 'GST', 3);
   ```

   To stop selling a length, set `active = false`. Don't delete it: past orders refer to it. To change a price, update the row; orders already made keep what was paid.
3. **Secrets.** Set them on the project:

   ```bash
   npx supabase secrets set RAZORPAY_KEY_ID=rzp_test_... RAZORPAY_KEY_SECRET=... RAZORPAY_WEBHOOK_SECRET=... --project-ref <project-ref>
   ```

   The webhook secret is any long random string you choose; Razorpay asks for the same one in step 5.
4. **Deploy the function.** `supabase/config.toml` turns off Supabase's token check for it, because Razorpay's webhook has no Supabase token. The `/checkout` and `/confirm` routes check the user's token themselves.

   ```bash
   npx supabase functions deploy payments --project-ref <project-ref>
   ```

5. **Webhook.** In Razorpay, go to Account & Settings → Webhooks and add one:
   - URL: `https://<project-ref>.supabase.co/functions/v1/payments/webhook`
   - Secret: the `RAZORPAY_WEBHOOK_SECRET` from step 3
   - Events: `order.paid`
6. **Billing.** Turn it on as described in [editions.md](./editions.md). Settings → Plan then shows Business and its lengths.

To go live, do steps 3 and 5 again with the live keys and a live-mode webhook.

## Testing

In test mode, pay with the test cards or UPI IDs from Razorpay's documentation; no money moves. Then check:
- Settings → Plan says how long you're covered;
- the payment is listed under Payments;
- `entitlements` has a `purchase` row whose `payment_ref` is the payment id;
- buying during a trial starts Business when the trial ends.

## Refunds and problems

- **Refunds:** make them in the Razorpay dashboard. Then end or shorten the plan in SQL, for example `update entitlements set expires_at = now() where payment_ref = '<payment id>'`.
- **Paid, but no plan:** the webhook covers this. If the webhook wasn't set up, find the order in `payment_orders` (status `created`) and the payment in Razorpay, then run `select record_payment('<order id>', '<payment id>')` in the SQL editor.
- **Invoices and tax:** the app records what was charged, but makes no tax invoices. Razorpay can email receipts; any invoices that tax rules require are the operator's to issue.
