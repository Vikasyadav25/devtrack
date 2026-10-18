# Email login, registration and password recovery

Email/password is the default. Registration, email verification, login, logout and password reset work without a Google OAuth project. Gmail addresses are supported alongside other valid email addresses. Every account has separate progress, notes and history. Google sign-in remains optional when its Web Client ID is configured.

## Try it locally

```sh
npm run db:migrate
npm run dev
```

Open **http://localhost:5173**, choose **Create an account**, and enter your email and a passphrase of at least 12 characters. After registration, choose **Open local email preview**, follow **Verify email address**, confirm verification, then sign in.

For recovery, choose **Forgot password?**, enter the same email, open the local preview and follow **Reset password**. Set a new password and sign in again. Old sessions are revoked. Verification links expire after 24 hours; reset links expire after 30 minutes. Both are single-use.

**Local preview does not send an email to Gmail.** It is an explicit loopback-only development inbox enabled by `LOCAL_EMAIL_PREVIEW="true"`. Its API is unavailable in production and on non-loopback development hosts. It must never be enabled as a public mail inbox. The automated browser suite uses real registration, verification and sessions against its separate test database, not automatic mock login.

## Deliver real verification/reset emails to Gmail

The server uses Resend's HTTPS email API without a client SDK. Configure an account and a verified sender domain using [Resend's sending documentation](https://resend.com/docs/api-reference/emails/send-email). The recipient may be a Gmail address; the sender must be authorized by your mail provider. Do not impersonate an arbitrary gmail.com sender.

For local delivery, put these values in ignored `apps/api/.dev.vars.local` and restart the API:

```dotenv
RESEND_API_KEY="YOUR_SENDING_API_KEY"
MAIL_FROM="DevTrack <hello@YOUR_VERIFIED_DOMAIN>"
LOCAL_EMAIL_PREVIEW="false"
```

Do not share passwords, API keys or Google secrets in chat or source control. Registration and recovery fail with a clear unavailable response when neither a local preview nor a configured sender is available.

For production, apply migration `0004_email_accounts.sql` and configure:

```toml
AUTH_PROVIDER = "email"
ENVIRONMENT = "production"
LOCAL_AUTH = "false"
LOCAL_EMAIL_PREVIEW = "false"
ALLOWED_ORIGIN = "https://learn.example.com"
APP_URL = "https://learn.example.com/"
MAIL_FROM = "DevTrack <hello@YOUR_VERIFIED_DOMAIN>"
```

Store the API key with Wrangler, not in TOML:

```sh
npx wrangler secret put RESEND_API_KEY --config apps/api/wrangler.toml
```

`APP_URL` is the full frontend URL, including a repository subpath if applicable. Recovery URLs are built from this trusted configuration, never from the incoming Host header. A same-site frontend/API layout is still needed for session cookies. Account email sends run in the Worker's background execution context so provider latency does not reveal whether a recovery address exists. Monitor provider delivery errors and retry through Forgot password when needed; no message is claimed to have reached a recipient merely because an API request was accepted.

## Security and validation

Passwords use native `node:crypto` PBKDF2-HMAC-SHA256, 600,000 iterations, independent random salts and timing-safe comparison. Worker Node compatibility is enabled. Test the hashing workload against the production Worker's CPU allowance; do not lower the work factor to meet a deployment limit. See [Cloudflare's crypto support](https://developers.cloudflare.com/workers/runtime-apis/nodejs/crypto/) and [OWASP password storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

Session tokens and emailed tokens use 256 bits of randomness; only hashes are stored in the normal auth tables. Local development mail previews intentionally retain full links until expiry. Password hashes, identities, sessions and recovery tokens are excluded from learning-data exports. Verification is required before password login. Recovery uses generic responses, per-IP and per-email limits, expiring one-time tokens and transactional password replacement/session revocation. Existing account passwords cannot be overwritten by repeating registration. Resetting a Google-only account through its email can establish a password only after proof of mailbox access.

These decisions follow [OWASP's recovery guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html). Production email delivery has not been activated: no sender/API key has been supplied. Tests validate the provider request with a mock and the complete local workflow with the real Worker and D1.
