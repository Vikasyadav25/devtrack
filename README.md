# DevTrack

Prep Hub: browse all four preparation tracks at `/#/prep-hub`, including 16 public syllabus paths, topic references and direct practice links. See [catalog scope and sources](docs/PREP_HUB.md).

A private Java/backend interview study workspace: original lessons, linked DSA practice, honest attempt history, notes and deterministic spaced review. React + Vite + TypeScript, Tailwind, local shadcn-style primitives, TanStack Query, React Hook Form/Zod, Hono Worker and Cloudflare D1.

## Run locally

Prerequisites: Node 22.14+ and npm. Java 21+ is needed only to verify curriculum programs.

```sh
npm ci
npm run db:migrate
npm run db:seed
npm run dev
```

Open **http://localhost:5173** and register with an email and password. Follow the verification link in **Open local email preview**, then sign in. See [email authentication](docs/EMAIL_AUTH.md) for registration, password reset and real Gmail delivery setup. No Google Client ID is needed for email/password login. Progress persists in `apps/api/.wrangler/state/`. [Google sign-in](docs/GOOGLE_AUTH.md) remains optional.

```sh
npm run check
npx playwright install chromium
npm run test:e2e
npx tsx scripts/check-java.ts
npm run content:links
```

Java checks use `javac` and `java` from PATH, or `DEVTRACK_JAVA_HOME/bin`. Browser tests register and verify isolated email accounts, and automatically migrate and seed an isolated `devtrack-test` D1 database and run on ports 5174/8788. They do not modify your normal development database or contact LeetCode or production services.

## What is included

- Dashboard, roadmap, catalog/search/filtering, lesson and case readers, Java code copy and on-demand Mermaid diagrams.
- Problem attempts, confidence, immutable review events, due/overdue queue, later-day mastery checks, prerequisite recommendations and daily budget planning.
- Markdown notes, timed mock reflections, light/dark preference and validated owner-scoped JSON backup/merge import.
- 10 published DSA pattern lessons, 110 unique canonical problem links, 12 Java, 8 backend and 3 CS lessons, 5 LLD and 5 HLD cases. Counts and validation failures are generated in `docs/CONTENT_REPORT.json`.
- A 48-entry draft DSA syllabus. Draft coverage is not finished lesson coverage.

LeetCode blocked automated HEAD checks with HTTP 403 in this environment. Links remain visibly `needsVerification`; the report records the actual response. The bank uses supplied canonical IDs/slugs and original educational summaries, not copied problem statements or solutions.

See [deployment instructions](docs/DEPLOYMENT.md), [architecture](docs/ARCHITECTURE.md), [content guidelines](docs/CONTENT_GUIDELINES.md) and [remaining work](docs/PROGRESS.md). Nothing has been deployed to a real account. Production requires your Cloudflare D1 ID, email sender/API key and GitHub Pages domain configuration. Google OAuth configuration is optional.
