# Cloudflare Turnstile for Supabase Auth

ISP-157 protects email/password signup, login, and forgot-password requests
with Cloudflare Turnstile. Supabase Auth performs the authoritative token
verification. The browser success callback only supplies a short-lived token.

## Production setup

1. In Cloudflare, create a managed Turnstile widget and allow the production
   web hostname.
2. Add `VITE_TURNSTILE_SITE_KEY` to the web deployment environment in Vercel.
   The site key is public and is expected to be present in the browser bundle.
3. In Supabase Dashboard, open **Authentication > Bot and Abuse Protection**.
4. Enable CAPTCHA protection, select **Cloudflare Turnstile**, enter the
   Turnstile secret key, and save.
5. Never add the secret key to Vercel's frontend variables or any `VITE_`
   variable.

Enabling Supabase CAPTCHA enforcement without deploying the matching site key
will block the protected email/password flows. Deploy the frontend setting
before enabling enforcement, or make both changes during the same release.

## Local development

Use a separate Turnstile widget that allows `localhost`, or Cloudflare's
documented testing keys. Set:

```text
apps/web/.env
VITE_TURNSTILE_SITE_KEY=your-development-site-key

supabase/.env
TURNSTILE_SECRET_KEY=your-matching-development-secret-key
```

The local Auth service reads the secret through `[auth.captcha]` in
`supabase/config.toml`. Real `.env` files are ignored by Git; only placeholder
examples are committed.

## Login decision

Supabase CAPTCHA enforcement covers sign-in as well as signup and password
recovery, so all three email/password entry points render the challenge. An
adaptive login challenge was intentionally deferred because it would require
durable server-side failed-attempt tracking. Existing API rate limits and
mandatory admin MFA remain separate controls and are unchanged.

## Manual checks

- Complete a valid challenge on signup, login, and forgot password.
- Confirm each form remains disabled before a token is available.
- Let a challenge expire and confirm it refreshes and requests completion.
- Exercise a failed challenge and retry on mobile and with keyboard navigation.
- Confirm an invalid or reused token is rejected by Supabase.
- Confirm admin login still proceeds to the existing MFA challenge.

References:

- https://supabase.com/docs/guides/auth/auth-captcha
- https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/
- https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
