# Admin MFA Foundation

ISP-142 uses Supabase Auth's provider-supported TOTP MFA. The application does
not generate, store, or verify its own OTP secrets.

## Status model

| Requirement | Meaning |
| --- | --- |
| `enrollment_required` | The authenticated admin has no verified TOTP factor. |
| `challenge_required` | A verified TOTP factor exists, but the current session is below AAL2. |
| `verified` | A verified TOTP factor exists and the current session is AAL2. |

`GET /api/admin/mfa-status` first verifies the authenticated account's `admin`
role. It then obtains factor status and authenticator assurance directly from
Supabase. The response contains no factor secret, QR content, or verification
code.

The frontend helper in `apps/web/src/features/auth/admin-mfa.ts` validates this
response for the enrollment and challenge routes implemented by later tickets.
ISP-142 does not yet block the admin portal: forced enrollment belongs to
ISP-143, and login challenges/API AAL2 enforcement belong to ISP-144.

