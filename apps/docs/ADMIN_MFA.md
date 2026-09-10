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

## Recovery and factor reset

ISP-145 intentionally does not provide an in-app "disable MFA" or peer-admin
reset button. The application has no super-admin role or sufficiently strong
help-desk identity-verification workflow, so either option would let an admin
silently weaken another administrator's account.

If an administrator loses every enrolled authenticator, use this controlled
provider-side procedure:

1. A designated Supabase project owner verifies the affected administrator's
   identity through the organization's established out-of-band process. Email
   access alone is not sufficient proof.
2. A second authorized person confirms the target email and Supabase user UUID
   before any factor is removed.
3. The project owner uses a trusted server-side administrative environment and
   Supabase Auth Admin MFA `listFactors({ userId })` to identify the lost
   verified factor. Never place the service-role key in browser code.
4. Remove only the confirmed lost factor with
   `deleteFactor({ userId, id: factorId })`. Supabase invalidates the affected
   user's active sessions when a verified factor is deleted.
5. Record the incident/reference, requester, approver, target user UUID, reason,
   factor ID, and time. Do not record a TOTP secret or verification code.
6. The administrator signs in again. Mandatory enrollment redirects the account
   to `/admin/mfa/enroll`, where a new provider-issued TOTP factor must be
   verified before admin access is restored.
7. Confirm the new login reaches AAL2 and review Supabase Auth Audit Logs for the
   factor deletion, new enrollment, and verification events.

Supabase Auth Audit Logs are the authoritative authentication-event audit trail
for provider-side MFA operations. Application audit logs do not replace them.
Only trusted operators with server-side service-role access may perform this
recovery procedure. Customers and technicians are outside this workflow.
