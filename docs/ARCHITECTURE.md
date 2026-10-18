# Architecture

`apps/web` is a static SPA using HashRouter. Private data is fetched through TanStack Query from `/api/v1`; public seed curriculum is also served through authenticated API reads. Vite proxies requests locally. Route modules separate catalogs, readers, revision, planner, notes, settings, mocks and analytics. Shared UI primitives live in `components/`. Mermaid is loaded only after a user requests a diagram; source is always readable.

`apps/api` runs Hono on a Worker with D1 binding. Authentication is a dedicated module. Zod schemas validate all writes. SQL values use bindings; interpolated table/column identifiers are fixed allowlists. Each private query includes the authenticated user identity. Emails select stable user records, so changing the configured owner does not expose a previous owner's rows.

`packages/shared/src/domain.ts` contains deterministic calendar scheduling, prerequisite, mastery and budget rules. Calendar dates are stored as YYYY-MM-DD in the user's configured IANA time zone; event instants remain UTC ISO strings. The time zone is fixed after reviews exist to avoid silently reinterpreting stored dates. Good reviews progress 3/7/14/30/60/120 days. Again resets to one day. Easy advances at least to seven days. A problem requires an independent solve and successful recall on a later calendar day to become mastered.

Attempt insertion, progress accumulation, initial review state and focused-minute recording share one D1 batch. Review event insertion is conditional on an observed state version; dependent state/progress updates require that event. A stale concurrent request cannot overwrite a newer schedule. Event IDs provide replay protection. D1 batches execute transactionally; SQLite integration tests reproduce the batch rollback boundary. Review history is append-only through the API.

Versioned JSON under `content/` is the curriculum source. Seed scripts escape public literals, upsert stable IDs and maintain problem-pattern relationships. User data is never deleted by a content upsert. A problem may belong to several patterns while retaining one progress identity. The full roadmap has explicit draft entries rather than fabricated lessons.

Markdown is rendered without raw HTML and passed through rehype-sanitize. Links are outbound references; problem statements and third-party solutions are not copied. Mermaid uses strict security mode. Notes and imported strings are rendered through React/Markdown boundaries rather than injected HTML. Only Mermaid-generated strict-mode SVG is inserted into the DOM.

Backups use a strict table/schema allowlist, explicit owner match and server-injected ownership on every inserted row. An import is one transactional merge: existing IDs remain unchanged. Review events are never rewritten. The current import ceiling is documented. A schema migration is required before changing backup field definitions.

The app remains focused on personal study, with private data scoped to each registered account. It does not execute arbitrary code on a server, provide an AI tutor, or claim company-specific interview cutoffs. Local Java content checks run trusted authored examples, not user submissions.

Browser tests launch a separate test Worker and Vite mode on ports 8788 and 5174, with an isolated D1 binding. They run notes, backup, reader, attempt and persistence flows without reusing the normal development server.

Google sign-in remains an optional provider. See GOOGLE_AUTH.md for browser-bound nonce challenges, ID-token validation, stable Google-subject mapping and hashed opaque sessions. Normal local development no longer auto-authenticates. Cloudflare Access remains an explicit alternate provider; the browser suite now uses isolated real email accounts and sessions. Auth sessions and identities are deliberately excluded from learning-data backups.

Email/password is now the default identity provider, with verified registration and one-time password recovery. Native PBKDF2 hashes, email tokens and sessions live in separate auth tables and are never included in curriculum/progress backups. Each registered user retains server-scoped ownership. Google and Access modes remain available. Local email preview is explicitly restricted to loopback development; real delivery uses a configured HTTPS mail provider. See EMAIL_AUTH.md.
