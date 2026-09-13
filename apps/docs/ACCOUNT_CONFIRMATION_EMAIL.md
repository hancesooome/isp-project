# Account Confirmation Email

ISP-135 stores the canonical Supabase Auth account-confirmation template at
`supabase/templates/confirmation.html`. It uses email-safe table HTML, inline
styles, and Supabase's provider-generated `{{ .ConfirmationURL }}`. Raw tokens
and authentication codes are not displayed in the email.

## Hosted Supabase setup

Repository configuration applies to the local Supabase stack only. For the
hosted project:

1. Open Supabase Dashboard → Authentication → Email Templates.
2. Select **Confirm signup**.
3. Set the subject to `Verify your email address`.
4. Copy the complete contents of `supabase/templates/confirmation.html` into
   the message body and save it.
5. Under Authentication → URL Configuration, confirm the production site URL
   and any intended signup redirect URLs are allow-listed.
6. Create a test customer account and confirm the **Verify email** button opens
   the expected production hostname and completes verification.

Keep email-provider click tracking disabled for authentication emails because
rewritten links can interfere with provider verification URLs.
