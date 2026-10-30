# Order email history

The order detail page now records confirmation, shipping and manual update emails with an immutable subject/HTML/envelope snapshot, creation time, provider acceptance time, automatic/manual origin and initiating administrator where applicable. Existing emails are not backfilled: previous exact content and delivery times were not stored.

## Rollout

Apply the additive migration before serving the updated app:

```
npx prisma migrate deploy
```

Generate the Prisma client as part of the normal build. The existing `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are required for sends. No live database migration or email send was performed during development.

The new `OrderEmail` table is needed for both the order detail page and outgoing order mail. Logging fails closed: if the initial record cannot be saved, no email is sent. Do not deploy application code before the migration.

## Status semantics

- PENDING: recorded; no conclusive provider acceptance saved yet. This can also indicate an interrupted request or failure saving the provider result. Check the provider before retrying.
- ACCEPTED: Resend returned an email ID. This is **not** inbox delivery or a read receipt.
- FAILED: provider explicitly rejected the request.
- UNKNOWN: transport uncertainty or missing acceptance ID. Check the provider before creating a new send.

Manual requests use a unique request key, and Resend receives a per-log idempotency key. Duplicate submissions return the existing record without sending again. The UI allows a fresh explicit attempt after a definite rejection, but preserves the key after uncertain failures. Uncertain/PENDING attempts are not automatically retried.

The recipient is resolved server-side from the order and the administrator identity comes from the session. The form sends plain text escaped into a branded HTML message; it does not change order status. The history preview uses a sandboxed iframe with a restrictive CSP and also exposes the exact saved HTML. Email bodies are visible only on the administrator order page and are deleted with the order.

## Validation

```
node --test tests/order-email-history.test.cjs tests/order-confirmation.test.cjs tests/preorder-stock.test.cjs
npx tsc --noEmit
```

Tests use a fake mail provider and database, including failures and duplicate requests. Live migration, provider delivery and browser visual verification remain rollout checks.
