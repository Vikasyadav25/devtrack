# Google sign-in

DevTrack uses the official Google Identity Services button and verifies Google ID tokens on the Worker with Google's public signing keys. No client secret is needed for this flow. The browser receives an opaque HttpOnly session cookie; raw session tokens and Google credentials are never stored in localStorage. Session token hashes expire after seven days and logout revokes the current session.

## Configure the Google project

1. Open [Google Auth Platform](https://console.cloud.google.com/auth/overview) and select/create your own project.
2. Configure branding and audience for your app. If the app is in testing, add your allowed Google account as a test user.
3. Create an OAuth client with application type **Web application**.
4. Add these **Authorized JavaScript origins** for local use:

```text
http://localhost
http://localhost:5173
```

5. For deployment, add your exact HTTPS frontend origin, such as `https://learn.example.com`. This JavaScript callback flow does not need an authorized redirect URI.
6. Copy the public Client ID ending in `.apps.googleusercontent.com`. The client secret is not used; do not put it in this repo or chat.

See Google's [setup guide](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid), [button guide](https://developers.google.com/identity/gsi/web/guides/display-button), and [server verification requirements](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).

## Local configuration

Copy `apps/api/.dev.vars.example` to `apps/api/.dev.vars.local` and fill:

```dotenv
GOOGLE_CLIENT_ID="YOUR_WEB_CLIENT_ID.apps.googleusercontent.com"
OWNER_EMAIL="your-account@gmail.com"
```

Use a Gmail account or a Google Workspace account with a verified hosted-domain claim. Other Google accounts backed by third-party email addresses are deliberately rejected because this app relies on Google's authority over the allowed email. In Google-only mode, the configured owner account is allowed. In the default email mode, verified Gmail/Workspace users may sign in and receive separate private workspaces.

```sh
npm run db:migrate
npm run dev
```

Restart the API after changing variables. Open **http://localhost:5173**. The `127.0.0.1` page links to the configured localhost origin to avoid an OAuth origin mismatch. Local auto-login is off. Google-only mode stays visibly pending until its configuration is supplied; the default email/password mode remains usable without it. Existing local mock-user progress is kept separate from the verified Google account.

## Production configuration

Set these non-secret Worker variables and keep `LOCAL_AUTH` disabled:

```toml
AUTH_PROVIDER = "google"
GOOGLE_CLIENT_ID = "YOUR_WEB_CLIENT_ID.apps.googleusercontent.com"
OWNER_EMAIL = "your-account@gmail.com"
ALLOWED_ORIGIN = "https://learn.example.com"
ENVIRONMENT = "production"
```

Apply all migrations, including `0003_google_auth.sql`, and deploy the Worker. Google auth routes must be reachable without a Cloudflare Access challenge; Google auth performs the login itself. Cloudflare Access remains an alternate mode when explicitly configured with `AUTH_PROVIDER="access"`.

Use a same-site production frontend/API layout, such as `learn.example.com` and `api.example.com`, so browsers can send session cookies. Production cookies have Secure, HttpOnly, SameSite=Lax and the __Host- prefix. Cross-origin JSON writes require the exact allowed origin. Local HTTP cookies omit Secure only for loopback development. Session lookup fails on non-loopback development hosts.

The backend verifies signature, issuer, audience, expiry, issued-at recency, nonce, verified email and the allowed account. A short-lived browser-bound challenge is consumed once, preventing login CSRF and replay. Google subject IDs are mapped to stable user IDs. Login attempts are rate-limited separately from authenticated writes. Signing out is available in Settings.

## Verification status

Automated tests use locally generated RSA-signed Google-shaped tokens and isolated D1 databases. They validate server behavior, session hashing, ownership, expiry, logout and failed/replayed login attempts. A live Google login still requires your real client configuration and an interactive browser test with your account; automated tests do not claim that external setup is complete.
