# Customer Portal Entitlements

This document defines the customer lifecycle access policy introduced by
ISP-139. It describes product access only. Frontend navigation applies this
policy in ISP-140, and server-side enforcement remains the security boundary
implemented in ISP-141.

The typed source of truth is
`apps/web/src/features/account/customer-entitlements.ts`.

## State precedence

1. Use the authoritative subscription status when a subscription exists.
2. Use application status only when there is no subscription.
3. Treat an unknown or inconsistent runtime status as `account_only`.

This precedence prevents an older approved application from restoring active
service capabilities after its subscription has been canceled.

## Access matrix

| Authoritative state | Access level | Intended portal access |
| --- | --- | --- |
| No subscription and no application | `account_only` | Overview, apply, support, account |
| Application `pending` or `rejected` | `applicant` | Overview, apply, application status, support, account |
| Application `approved` or subscription `pending_activation` | `awaiting_installation` | Overview, application, installation, support, account |
| Subscription `active` | `active_subscriber` | Full customer portal and active-service actions |
| Subscription `past_due` | `past_due_subscriber` | Service visibility, billing/payment/history, cancellation and support; no plan changes |
| Subscription `suspended` | `suspended_subscriber` | Billing/payment/history, cancellation, support and account; no active-service controls |
| Subscription `canceled` | `former_subscriber` | Historical billing, invoices, statements, service history, support and account |

Payment access remains available for past-due, suspended, and former
subscribers so eligible outstanding invoices can still be resolved. Historical
records are retained after cancellation. Resource ownership must still be
enforced by the backend and database; an entitlement never grants access to
another customer's data.

