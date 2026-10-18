# DevTrack progress

## Prep Hub update - 17 October 2026

Added a separate searchable resource index for all four takeUforward Prep Hub tracks: 15 public paths, 230 modules, 2,483 syllabus occurrences and 1,324 topic identities. The index has 497 distinct practice destinations among 581 shared resources, with direct canonical LeetCode links, GFG/source practice, free documentation and existing local study shortcuts. It includes access labels, free/practice filters, collapsible modules and mobile layouts. This expands linked syllabus coverage; it does not count external lesson/quiz titles as locally authored content. See PREP_HUB.md for provenance and exact scope.

Link validation matched 339 problem slugs against LeetCode metadata and received successful HEAD responses for the other 243 resources. No unverified resource URLs remain in this snapshot. Canonical matching and HTTP reachability are reported separately in content/prep-link-report.json.

Implementation date: 16 October 2026.

## Completed source

- M0: npm workspace, React/Vite UI, Hono Worker, shared types/schemas/domain rules, D1 migrations, isolated local authentication and production Access JWT validation.
- M1 workflows: dashboard, DSA pattern/problem readers, Java/backend readers, LLD/HLD readers, attempts, confidence, progress, review events and queue, prerequisite-aware daily planning, notes CRUD, mock reflections, analytics, settings and owner-validated backup merge.
- Original seed: 10 published patterns, 110 distinct problem IDs, 12 Java lessons, 8 backend lessons, 3 CS lessons, 5 LLD and 5 HLD cases.
- All 28 standalone Java examples/LLD tests compiled with Java 21 target and produced the expected output.
- Local D1 migrations and content seeding executed successfully.
- GitHub Pages workflow and account-specific Cloudflare/Access deployment instructions included.

## Verification results

Passed: formatting, ESLint, TypeScript, 19 unit/integration tests, 4 Chromium browser tests, all 28 Java examples/LLD tests, content validation, the production Vite build and a Worker deployment dry run. Browser coverage includes note CRUD, bookmark persistence, JSON restore, study attempts, mobile reload, code copying, Mermaid, search, theme persistence and responsive navigation. The browser suite uses its own D1 database. Mermaid remains on-demand; its optional renderer chunks trigger a Vite size advisory but are not loaded for the dashboard. Production authentication policy, live CORS/cookies and cross-device sync require the real account/domain setup and cannot be inferred from local tests.

## Content verification

The link checker attempted all 110 LeetCode URLs. All returned HTTP 403 in this environment and remain flagged for manual verification, including visible reader warnings. See `content/link-report.json`. Counts do not imply successful live-link validation.

## M2 remaining curriculum batches

- The 48-entry DSA syllabus is explicitly draft coverage; published modules currently combine related patterns. Split fixed/variable windows, binary-search-on-answer and other subpatterns into independent deep lessons as content is authored.
- Expand to 300 unique problems with problem-specific hints, canonical difficulty review and manual verification when the platform blocks requests.
- Complete the broader Spring Boot/JPA/Kafka/SQL/cloud/CS syllabus and progressive prerequisites.
- Expand LLD to 25 and HLD to 30 cases, including SDE-3 migration, incident, cost and leadership exercises.
- Add richer mixed-practice session sets, retention/calibration history, ADRs and persistent behavioral story tracking.
- Optional M3 PWA/offline reading and notifications remain deferred.

## Deployment status

Local implementation only. No GitHub repository, remote D1 database, Cloudflare Access application or hosted deployment has been created. Real account identifiers and domains are still required; no secrets are committed.

## Google sign-in update - 17 October 2026

Added Google Identity Services login, verified ID tokens, browser-bound nonce challenges, stable Google subject mapping, hashed seven-day HttpOnly sessions, logout and independent sign-in rate limiting. Normal local auto-login is disabled; tests retain isolated mock auth. Migration 0003 was applied locally. Real Google activation is pending the owner's OAuth Web Client ID and allowed Google account; no external Google project has been configured. See GOOGLE_AUTH.md.

Google auth verification: formatting, lint, typecheck, 24 unit/integration tests, 5 browser tests, production web build and Worker dry run passed. The local frontend is running at http://localhost:5173; private /me correctly returns 401 before Google sign-in. Real Google consent/sign-in is still pending account configuration.

## Email accounts update - 17 October 2026

Email/password is now the default, with registration, verified email, login/logout and password recovery. Existing Google sign-in is optional. Every registered user has isolated progress and notes. Migration 0004 adds salted password hashes, hashed single-use verification/reset tokens, per-email rate limits and an explicit loopback-only email preview. Password resets revoke prior sessions. The browser suite now signs in with real accounts rather than using the local auth bypass.

Real verification/reset email delivery to Gmail is pending sender/API-key configuration. Local preview clearly states that no email was sent. See EMAIL_AUTH.md for local usage and deployment setup.

Email-auth verification: 31 unit/integration tests and all 6 real Worker/D1 browser flows passed, including registration, verification, login, logout, reset, prior-session revocation and account isolation. Formatting, lint, typecheck, content validation, web build and Worker dry run passed. The normal local app runs at http://localhost:5173 with email/password enabled and the explicit local email preview.
