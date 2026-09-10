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
ISP-143 redirects administrators without a verified TOTP factor to
`/admin/mfa/enroll`. Enrollment starts only after an explicit action, displays
the provider-issued QR code, and verifies a six-digit authenticator code through
Supabase. An admin can leave this flow only by completing enrollment or signing
out.

ISP-144 redirects enrolled administrators whose current session is only AAL1
to `/admin/mfa/challenge`. A valid authenticator code upgrades the Supabase
session to AAL2. The backend independently requires verified AAL2 for admin API
access, including routes shared with technicians when the caller is an admin.
