# Agreed delivery setup

- GLS PakkeShop: 49 DKK per order, including VAT.
- daoSHOP: 49 DKK per order, including VAT.
- Club pickup: free.
- Product discount codes do not discount shipping. No free-shipping basket threshold.

## Implemented

The cart offers GLS PakkeShop or daoSHOP and a postcode search. Selection is
required before payment. Checkout re-fetches the available points and persists
the provider's ID/address/product snapshot atomically with the pending order.
Client-supplied names, addresses and prices are never trusted. A missing or
unavailable point, provider outage, or failed database write prevents payment.
Pickup (including trainer pickup) and price previews need no Shipmondo access.

Stripe charges a separate 49 DKK shipping rate, unaffected by product coupons,
and displays the chosen shop. Stripe collects the customer's billing address,
name and phone; the pickup address is stored separately. Confirmation email,
confirmation page, customer order details and admin/print view show the snapshot.
Old home-delivery orders preserve their original address handling.

Labels are created MANUALLY in Shipmondo when goods are ready. The admin view
shows the precise product and service point ID to use with the customer's name,
phone, email and address. No label is purchased and no customer order is exported
automatically. This Delivery Checkout key cannot provide full shipment booking
or order import. Account billing, label prices and sender setup must be checked
in Shipmondo before shipping the first parcel.

## Release sequence (do not merge before completing prerequisites)

1. Set `SHIPMONDO_DELIVERY_CHECKOUT_KEY` in hosting Preview and Production using
   the supplied Delivery Checkout key. Never use a `NEXT_PUBLIC_` prefix.
2. Apply the additive migration with `npx prisma migrate deploy` using the
   intended database connection and review migration status. New migration:
   `20261103120000_order_delivery`. It adds a separate `OrderDelivery` table with
   a cascading order relation; existing orders and addresses are not rewritten.
   Do not use `db push` or reset the database.
3. Run `node scripts/check-shipmondo.mjs` with the environment loaded. Both
   carriers/products and the 6623 lookup must pass. Optional `--database` checks
   the snapshot table exists with the required columns using `DATABASE_URL`.
4. Deploy this branch to a preview with Stripe TEST credentials and a test
   database (not the production order database). Test both carriers, postcode
   changes, pickup, a 100% product code (shipping still 49 DKK), cancelled payment,
   and a successful test payment. Verify the saved point, confirmation email and
   duplicate webhook delivery (one order/confirmation only). Keep Resend in a
   test configuration and send only to a controlled test inbox.
5. Only after the preview test passes, merge the branch into master to publish
   the price and picker together. Verify lookup and cart on the live shop.

Rollback: redeploy the previous app version; leave the additive table intact so
new order snapshots are preserved. Do not drop the table or erase paid orders.

## Validation recorded locally

Read-only live Shipmondo lookup passes for both carriers. Browser testing of the
actual cart component with a local test item verified GLS and dao results,
selection enabling checkout, carrier changes clearing selection, invalid postcode
feedback, and pickup changing the total from 324 DKK to 275 DKK. The temporary
local preview route was removed after testing. Automated tests cover
trusted snapshot selection, tampering, deleted shops, provider/database failure,
separate shipping charges, pickup, legacy orders and escaped email rendering.
Full Stripe/DB end-to-end verification requires hosting/test environment access;
no live payment, customer email or label purchase was performed.

References:
- https://shipmondo.dev/docs/shipping_module/authentication/
- https://shipmondo.dev/docs/shipping_module/listing_service_points/

## Account verification — 2026-11-03

User confirmed NemSport is the intended account. Delivery Checkout authentication
was verified successfully against the live read-only API. Both GLS ShopDelivery
(`GLSDK_SD`) and daoSHOP indleveret (`DAO_STS`) are available for Denmark.
Service-point lookup returned 10 results per product for postcode 6623, including
SuperBrugsen Vorbasse, Vestergade 11 (GLS ID 96280, dao ID 41384).

Verified lookup parameters: `product_code`, `country_code=DK`, `zipcode`, and
`frontend_key`. Product listing requires `carrier_code`.

The key is stored only in ignored `.env.shipmondo.local` with owner-only access.
Hosting configuration is still outstanding: set `SHIPMONDO_DELIVERY_CHECKOUT_KEY`
in the appropriate environment. Do not commit its value or use a NEXT_PUBLIC key.
Repeat the read-only account check with:

```sh
node --env-file=.env.shipmondo.local scripts/check-shipmondo.mjs
```

Successful lookup does not validate label purchasing, account billing, shipment
creation or live checkout integration. No labels or orders were created by this
check. The price branch must remain unmerged until the full checkout is ready.

## Final local checks

- 70 automated tests pass; TypeScript and lint checks pass.
- Next.js production compilation and type checking pass. Full build/prerender
  cannot finish locally because existing admin pages require the database
  connection, which is not available in this workspace. A build-only dummy
  Resend value was used to avoid requiring the email credential at import time;
  no outgoing emails were sent.
- Production migration and real Stripe test payment remain unverified until the
  hosting/test environment is configured. Do not describe this as deployed.
