# Prep Hub resource index

Inspected 17 October 2026: https://takeuforward.org/prep-hub. Open the local app at http://localhost:5173/#/prep-hub after signing in.

The index includes 15 course cards and 230 public syllabus modules across the four tracks; C++ for Beginners is excluded. Public syllabus trees were expanded in a browser without signing in. Only titles and factual topic relationships were retained; no lesson text, solutions, videos or source quiz questions were copied.

| Track            | Paths | Modules |
| ---------------- | ----: | ------: |
| DSA              |     5 |      76 |
| Core CS          |     6 |     102 |
| System Design    |     2 |      19 |
| Data Engineering |     2 |      33 |

There are 2,483 indexed occurrences across the sheets, resolving to 1,324 topic identities. Identity includes subject context, so a generic title in two subjects can be separate. A repeated normalized title within one module is deduplicated. Counts include syllabus quizzes, contests and section entries; they are **not** counts of authored lessons or independently solvable problems. The source's advertised topic totals differ because some totals exclude quizzes and contests. The existing 110 fully modeled DevTrack problems and authored lesson counts remain separate.

`content/prep-hub.json` contains the source URLs, ordered modules, shared topic identities and shared resources. Each topic has a corresponding practice link or a reference covering its subject/module. A broad reading reference is labeled as reading, never as the exact exercise. Ambiguous renamed SQL questions retain reference material instead of a guessed LeetCode equivalent. Existing local study pages are linked where a corresponding lesson/problem exists. Repeated questions share one resource.

There are 497 distinct practice links and 581 resources in total. Of these, 339 LeetCode problem slugs were matched against LeetCode's public metadata APIs, including the database catalog; the API also determines premium status. Other DSA problem-title/link mappings use public factual metadata from https://github.com/geckguy/striver-a2z-sheet; no solution code or problem statements were copied. Source practice links whose access is not independently known are labeled “Access varies.” Other resources include official PostgreSQL/Java/RFC documentation, OSTEP chapters, university networking exercises, CP Algorithms and open source Java pattern implementations.

The link report at `content/prep-link-report.json` distinguishes canonical catalog matches from HTTP reachability. All 243 non-catalog URLs returned successful HEAD responses after replacing the PostgreSQL Exercises index with its working basic-exercises page. A successful HTTP response is not a guarantee that a site's login policy or content will remain unchanged. The original 110-problem HEAD report is independent and is not silently overwritten by this check.

The page supports track/path filters, topic/module search, practice-resource filtering, free-resource filtering, external links, local lesson shortcuts and URL-persisted filters. Topics mount when modules expand, and the catalog loads in a separate route chunk. External completion is not automatically synced to DevTrack progress. Free-resource filtering hides account, premium and unknown-access destinations; source syllabus attribution remains available separately. Source quiz titles point to revision references; quizzes themselves remain on the original site.

Maintenance:

- Edit factual catalog metadata in `content/prep-hub.json`; use HTTPS resources and accurately label access.
- Run `npm run content:validate` to check identities, module references, resources and internal routes.
- Run `npm run content:prep-links` to refresh canonical metadata, access labels and link reachability. This fetches public metadata/HEAD responses only.
- The catalog is static build content. No database migration or seed reset is needed, and existing notes/progress remain intact.
