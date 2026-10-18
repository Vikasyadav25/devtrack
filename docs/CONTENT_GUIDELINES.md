# Curriculum authoring

Source files: `content/dsa/patterns.json`, `content/dsa/problems.json`, `content/lessons.json`, `content/cases.json`, and `content/roadmap.json`. Keep stable slugs and problem IDs. Every entity has `status` and `updatedAt`. Use `draft` until the entire lesson is reviewable.

Published pattern explanations must have at least 400 words, Java code, an invariant, a dry run, complexity and at least eight linked problems. Published Java/backend explanations must have at least 500 words, a standalone Main program with exact output, three interview Q&As and practice/recall tasks. Do not replace useful explanations with word-count padding. Shared learning-method guidance supplements topic-specific mechanisms.

Published design cases require a coherent baseline, requirements, textual Mermaid source, three tradeoffs and five follow-up questions. LLD cases also contain a standalone Java Main program with executable test assertions. The skeletons demonstrate the stated in-process invariant; persistence/hardware/payment adapters need their own integration tests and must not be described as implemented by those skeletons.

Use original prose and demonstrations. Link to authoritative language/framework documentation. Do not copy proprietary problem statements or solutions. The current problem pages intentionally direct learners to the canonical original for constraints and full statements. Numeric difficulties are curated, not inferred from IDs.

Run `npm run content:validate` before seeding. It writes `docs/CONTENT_REPORT.json` and fails on invalid published entries or unresolved internal pattern references. Run `npm run content:links` separately: it uses three concurrent HEAD requests, no scraping, no retries and a 12-second timeout. Non-200 responses remain visibly `needsVerification`; a 403 indicates a blocked checker, not a proven dead link. Record the actual status in `content/link-report.json`.

Run `npx tsx scripts/check-java.ts` using JDK 21+. It compiles every lesson example and LLD case, executes it and compares exact output. This validates the programs shown to the learner, not just app TypeScript. When adding a source reference, verify it manually if automation is blocked.
