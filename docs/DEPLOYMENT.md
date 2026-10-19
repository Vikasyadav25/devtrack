# Deployment: Cloudflare Worker + D1

## Current deployment

The live app and API share `https://devtrack-api.ratnivaofficial.workers.dev/`.
Wrangler serves `apps/web/dist` as static assets and routes `/api/*` to the existing Hono API.
This keeps the existing secure session cookies on the same origin without a custom domain.
The GitHub Pages workflow redirects to this app when the repository variable `LIVE_APP_URL`
is set to that URL, preserving hash routes. Without the variable, it publishes the standalone frontend.

The production `devtrack` D1 database is separate from local/test databases. All four migrations
have been applied and curriculum seeded. No local accounts, notes, or progress were uploaded.

To deploy an update from the repository root, use `npm run deploy` with `VITE_BASE_PATH=/`
and no `VITE_API_BASE_URL` override. This builds the frontend and deploys the Worker and assets.
Keep the root build for Cloudflare; the GitHub Pages build uses its own repository subpath.

Production uses a private username login configured by `SINGLE_USER_NAME` and `OWNER_EMAIL`.
The owner's salted password hash is stored in `password_accounts`, never in source code or
frontend assets. Sessions use the existing secure HttpOnly cookies, expiry and rate limits.
Private login uses native scrypt (`N=16384, r=8, p=5`) because the hosted Workers runtime
rejects the existing email mode's 600,000-iteration PBKDF2 cost. The email mode is retained
for local compatibility and must not be enabled in production without addressing that runtime limit.
Public registration, verification and password recovery routes are disabled in this mode.
Password changes must be performed by the administrator; do not re-seed account credentials
when deploying curriculum updates. Neither public development mail previews nor a login bypass
are enabled. Local and test environments retain the existing email registration flow.

The sections below describe the alternative custom-domain/API setup and optional identity providers.

Live checks on 19 October 2026 passed: username login, authenticated session after reload,
Secure/HttpOnly/Lax cookie flags, and creating, reading and deleting a temporary note in D1.

## Authentication and domains

Email/password registration is the default. Follow [email authentication setup](EMAIL_AUTH.md) to configure verification and password-reset delivery. The Worker stores salted password hashes and issues opaque HttpOnly session cookies. Google sign-in remains optional; see [Google setup](GOOGLE_AUTH.md).

Use GitHub Pages on `learn.example.com` and the Worker on `api.example.com`, or another same-site layout. Default `github.io` to `workers.dev` requests can encounter third-party-cookie restrictions and are not the supported production cookie arrangement.

Cloudflare Access remains optional with `AUTH_PROVIDER="access"`; the instructions below describe that alternative where indicated. Email and Google modes do not require an Access edge challenge.

## Create and seed the database

From the repository root:

```sh
npx wrangler login
npx wrangler d1 create devtrack
```

Put the returned database ID in the top-level `[[d1_databases]]` of `apps/api/wrangler.toml`. Keep the local binding separate. Configure production values:

```toml
[vars]
ENVIRONMENT = "production"
AUTH_PROVIDER = "email"
GOOGLE_CLIENT_ID = "YOUR_WEB_CLIENT_ID.apps.googleusercontent.com"
ALLOWED_ORIGIN = "https://learn.example.com"
ACCESS_TEAM_DOMAIN = "https://YOUR_TEAM.cloudflareaccess.com"
ACCESS_AUD = "YOUR_ACCESS_APPLICATION_AUD_TAG"
OWNER_EMAIL = "your-real-email@example.com"
```

These are configuration identifiers, not passwords. Do not add `LOCAL_AUTH` in production. The production environment also rejects the local bypass if that variable is accidentally set.

```sh
npx wrangler d1 migrations apply devtrack --remote --config apps/api/wrangler.toml
npm run db:seed -- --remote
```

Seeding upserts stable content identities without deleting progress. Review the target account and database before any remote command. Seed SQL is generated under ignored `.wrangler/seed.sql` and contains public curriculum only.

## Deploy the API and choose its identity provider

For the default email mode, configure the sender and secret from `EMAIL_AUTH.md`, apply all migrations through 0004 and deploy with the command below. Leave Google auth routes accessible to the sign-in flow. The remaining numbered Access setup is only needed if choosing `AUTH_PROVIDER="access"`.

1. Add `api.example.com` as a Worker custom domain in Cloudflare. Create a self-hosted Access application covering the entire API hostname.
2. Add an allow policy restricted to the same email as `OWNER_EMAIL`. Require your identity provider or email one-time login. Do not use a public bypass policy for API routes.
3. Copy the application audience tag into `ACCESS_AUD` and the HTTPS team origin into `ACCESS_TEAM_DOMAIN`.
4. Configure Access CORS so OPTIONS preflight requests reach the Worker without interactive authentication. Allow exactly the frontend origin, credentials, methods GET/POST/PUT/PATCH/DELETE/OPTIONS and Content-Type. The Worker also enforces this origin and responds to preflight itself. Follow [Cloudflare's CORS instructions](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/cors/).
5. Deploy:

```sh
npx wrangler deploy --config apps/api/wrangler.toml
```

Keep any `workers.dev` route protected too, or disable it in the Cloudflare dashboard. A route that bypasses Access still fails the Worker's independent JWT verification. A health endpoint is public at Worker level but may remain behind the Access edge policy.

JSON writes require `application/json`, exact allowed browser origin when present, authentication and ownership. A D1-backed limit allows 60 writes per owner per minute. Google login has a separate 30-request-per-IP-per-minute limit; optional Access mode delegates interactive login to Access. Browser requests cannot use a simple cross-origin form to bypass the JSON/preflight checks. No frontend secrets or service tokens are needed.

## Publish the SPA

Create a GitHub repository and push this workspace. In GitHub Settings → Pages, select **GitHub Actions** as source. Configure the Pages custom domain and HTTPS using GitHub's DNS instructions.

Set repository Actions variables:

- `VITE_API_BASE_URL`: `https://api.example.com` with no trailing path.
- `VITE_BASE_PATH`: `/` for the documented custom-domain root; `/REPOSITORY_NAME/` for a project Pages path if using a compatible cookie/domain arrangement.

The included workflow validates code/content and deploys `apps/web/dist`. Hash routing preserves direct-link refreshes without server rewrite rules. For a custom domain, add `apps/web/public/CNAME` containing your actual hostname before deployment. Never put a placeholder hostname in a published CNAME. [Vite's deployment guide](https://vite.dev/guide/static-deploy.html) explains base paths.

For email mode, register, verify your email and sign in. For optional Google login, use **Continue with Google** on the frontend. For optional Access mode, open `https://api.example.com/api/v1/me` in a top-level tab, complete Access login, then return to the frontend and retry. The frontend's connection screen links to this API sign-in URL. The site uses `credentials: include`; data stays in owner-scoped D1 rows across devices.

## Smoke test and backup

1. Verify an anonymous API request is rejected and a logged-in non-owner is rejected.
2. Open Sliding Window, copy its Java template, follow a problem link, record an independent attempt and confirm a review is scheduled for tomorrow in your configured time zone.
3. Reload on mobile, create/edit/delete a note and record a mock reflection.
4. Export JSON and restore into an empty account with the same owner identity. Imports merge missing records and preserve existing ones. Review calendar state is not a destructive rollback mechanism.
5. Check due dates, allowed origin, frontend base path, Access preflights and signed-in fetches on your actual browsers.

No live deployment, provider login or cross-device production test has been performed in this workspace. Local tests use isolated authentication; signed JWT verification is separately tested with generated RSA keys.

## Operational limits

This personal learning app now supports isolated registered accounts. Backup requests are limited to 1 MB and 2,000 total imported records. Reads currently use bounded catalog/problem lists and an unpaginated personal dashboard; large study histories need server-side aggregate queries before broader use. Keep independent JSON backups. Consult current [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) and [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) before choosing a plan; no pricing or free-tier entitlement is assumed.
