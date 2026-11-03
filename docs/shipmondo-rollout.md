# Agreed delivery setup

- GLS PakkeShop: 49 DKK per order, including VAT.
- daoSHOP: 49 DKK per order, including VAT.
- Club pickup: free.
- Product discount codes do not discount shipping. No free-shipping basket threshold.

The fixed shipping charge is implemented in a shared client/server function. The existing address-delivery checkout remains in place until the service-point integration is completed. This commit does not advertise a functioning GLS/dao selector, book labels, or transfer orders to Shipmondo.

Remaining integration prerequisites: configure the account's Delivery Checkout key securely in the hosting environment; verify available GLS and dao service-point products; validate actual service-point API parameters and responses with that account. Never paste full-access API secrets into a chat or expose them in browser code.

Implementation still needed: carrier and point selection before Stripe, server-side validation, durable point ID/address snapshot independent of billing address, order/admin/email presentation, and transfer to Shipmondo without buying labels before goods are ready. Confirm the complete flow in the test environment before changing the live delivery promise.

References:
- https://shipmondo.dev/docs/shipping_module/authentication/
- https://shipmondo.dev/docs/shipping_module/listing_service_points/
