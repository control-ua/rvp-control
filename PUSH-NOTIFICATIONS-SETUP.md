# RVP Control — background push setup

The frontend already registers `public/sw.js` and stores browser subscriptions through `src/lib/pushNotifications.ts`.

## 1. Apply the database migration

Apply:

`supabase/migrations/20260916130000_create_push_subscriptions.sql`

It creates:
- `push_subscriptions` — one row per browser/device subscription
- `push_delivery_log` — protects against duplicate webhook delivery

## 2. Deploy the Edge Function

Deploy:

`supabase/functions/send-push`

The repo includes `supabase/config.toml` with `verify_jwt = false` because the function is intended to be called by a Supabase Database Webhook. The function still requires the private `x-rvp-push-secret` header.

## 3. Add Edge Function secrets

Add these secrets in Supabase:

- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (example: `mailto:admin@example.com`)
- `PUSH_WEBHOOK_SECRET` — a long random secret

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided by the Supabase Edge Functions environment.

Important: the public key must match the `VAPID_PUBLIC_KEY` used in `src/lib/pushNotifications.ts`.

## 4. Create a Database Webhook

Create a Supabase Database Webhook with:

- Table: `public.applications`
- Event: `INSERT`
- Method: `POST`
- URL: your deployed `send-push` Edge Function URL
- Header: `x-rvp-push-secret: <same PUSH_WEBHOOK_SECRET>`

The standard Supabase webhook payload includes `record`, which the function accepts.

## 5. iPhone setup

On iPhone/iPad:

1. Open RVP Control in Safari.
2. Add it to the Home Screen.
3. Open the installed RVP Control app.
4. Sign in.
5. Open Settings → `Push на iPhone` → `Увімкнути push`.
6. Allow notifications in iOS.

After that, new rows inserted into `applications` can generate system notifications even while the PWA is closed.

## Security

- Never commit the VAPID private key.
- Never put `SUPABASE_SERVICE_ROLE_KEY` in frontend code or GitHub Pages environment variables.
- `send-push` only accepts requests with `x-rvp-push-secret` and re-fetches the application from the database before sending notification text.
