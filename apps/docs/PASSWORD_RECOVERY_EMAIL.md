# Password Recovery Email

ISP-153 stores the canonical Supabase Auth recovery template at
`supabase/templates/recovery.html`. It uses broadly supported table-based HTML,
inline styles, and Supabase's provider-generated `{{ .ConfirmationURL }}`.
Passwords, raw tokens, and authentication codes are never included in the copy.

## Hosted Supabase setup

Repository configuration applies to the local Supabase stack only. For the
hosted project:

1. Open Supabase Dashboard → Authentication → Email Templates.
2. Select **Reset Password**.
3. Set the subject to `Reset your ISP Platform password`.
4. Copy the complete contents of `supabase/templates/recovery.html` into the
   message body and save it.
5. Under Authentication → URL Configuration, confirm the production
   `/auth/reset-password` URL is allow-listed.
6. Send a test recovery email and confirm the CTA opens the expected production
   hostname and `/auth/reset-password` path.

Keep email-provider click tracking disabled for authentication emails because
rewritten links can interfere with provider verification URLs.
