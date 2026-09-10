# Authentication and Account Recovery Security Review

Reviewed for ISP-155 after customer entitlements, administrator MFA, and
password recovery were implemented.

## Reviewed attack paths

| Area | Control / result |
| --- | --- |
| Email enumeration | Login uses the same response for invalid credentials and unconfirmed email. Signup errors are generic. Recovery returns the same confirmation for unknown, rate-limited, and failed provider requests. |
| Recovery token leakage | Recovery URLs and tokens are not logged or rendered as visible email copy. The provider-generated confirmation URL is used only as the email CTA target. |
| Reset redirect validation | Recovery redirects are constructed from the current application origin and a fixed `/auth/reset-password` path. Supabase must also allow-list the exact production URL. |
| Expired or reused links | The reset form requires Supabase's `PASSWORD_RECOVERY` event and an authenticated recovery session. A direct, expired, or reused URL shows the invalid-link state. |
| Password-change session | After a successful password update, the app requests global sign-out and falls back to local sign-out so the browser cannot continue using the recovery flow. |
| Mandatory admin MFA | Admin routing distinguishes enrollment, challenge, and verified states. Unenrolled admins cannot skip enrollment. |
| Admin assurance | The API independently requires a verified TOTP factor and AAL2 for administrators. The MFA-status endpoint is the limited AAL1 exception needed to choose enrollment or challenge. |
| Customer entitlements | Customer capabilities are derived server-side from subscription/application state. Client navigation visibility is not treated as authorization. |
| Ownership | Customer API handlers derive the user ID from the verified bearer token and filter customer-owned records using that ID. Client-provided user IDs are not accepted as ownership proof. |
| Rate limiting | Supabase Auth protects hosted authentication/recovery endpoints. The application API also has general and write rate limits. |
| Sensitive logging | Auth tokens, authorization headers, secrets, passwords, and request bodies are excluded or redacted. Recovery URLs are not logged. |
| Open redirects | Login/OAuth destinations pass through an explicit internal-path allow list. Protocol-relative and external destinations fall back to `/account`. |
| Error messages | Authentication and recovery pages use application-owned generic messages. Provider callback details are not displayed. |

## Deployment checks

Before production release, manually confirm:

1. Supabase Site URL is the canonical HTTPS production origin.
2. Redirect URLs include the exact production `/auth/reset-password` and
   `/auth/callback` destinations; remove obsolete origins.
3. Production uses custom SMTP and appropriate Supabase Auth rate limits.
4. Email-provider click tracking is disabled for authentication messages.
5. TOTP enrollment, challenge, and verification APIs are enabled.
6. A password-only admin token receives no protected admin API data.
7. Supabase Auth Audit Logs record recovery and MFA events without application
   logs containing tokens or confirmation URLs.

## Manual regression matrix

- Unknown and registered emails receive identical recovery confirmation UI.
- Invalid/expired/reused reset links cannot display or submit the reset form.
- A valid reset link changes the password once and returns to a signed-out state.
- An admin resetting a password must still complete MFA at the next login.
- Customer, technician, and AAL1 admin tokens cannot access admin-only APIs.
- Customers cannot access another customer's invoice, statement, application,
  subscription, payment, or support record by changing a URL identifier.

No automated test files were added because repository policy requires explicit
approval before creating them. The matrix above should be executed with test
accounts against the deployed Supabase project.
