# Delivery verification

Verified on 4 October 2026 in an isolated development workspace.

| Check                                                         | Result                                                   |
| ------------------------------------------------------------- | -------------------------------------------------------- |
| Strict TypeScript compilation and Vite production build       | Passed                                                   |
| Frontend validation, auth requests and safe redirect unit tests | 14 passed                                                 |
| PostgreSQL migration / authorization / lifecycle checks       | 28 passed                                                |
| Production dependency audit                                   | Passed: 0 reported production dependency vulnerabilities |

The database tests execute the actual four migration files in PGlite (embedded PostgreSQL), with a minimal mock of Supabase's `auth`/`storage` schemas and roles. They test real PostgreSQL grants, RLS, constraints and secured functions rather than just looking for strings in SQL.

## Covered by database checks

- Approved signup domains, domain suffix spoofing, unapproved onboarding.
- Anonymous contact access denied; students can only read their own private account/contact rows.
- Direct role updates and privileged operations denied to students.
- Ownership derived from authenticated database context; cross-owner edits/completion/image writes denied.
- Three image slots, path validation, and staged-image privacy.
- Mutually exclusive sale/rental/request fields.
- Active-member contact lookup, private unique wishlist and private reports.
- Moderation requires reason and cannot suspend administrator accounts.
- Suspended sessions cannot post/contact/save/edit profiles.
- Completion reason validation, atomic telemetry, duplicate completion denial and completed-feed visibility.
- Rental/request completion, administrator listing removal and owner restore denial.
- Administrator counts, audit records, report review and configuration management.
- Administrator self-lockout prevention and immediate disabled-domain revocation.
- Image-retention candidate selection and revoked verification badge status.

## Not yet verified on external services

No user Supabase, Resend, Turnstile, GitHub or Cloudflare credentials were supplied. Therefore:

- No production Supabase project was created or modified.
- No real OTP was sent; email delivery, Auth hook wiring and CAPTCHA must be tested after dashboard configuration.
- Hosted Supabase Storage API and signed URL issuance were not exercised against your project.
- The maintenance Edge Function source is included but was not deployed or executed in Deno/Edge infrastructure.
- No website was published and no GitHub repository was created or pushed.
- No browser automation/visual inspection was available for this build. Desktop/mobile visual layout, keyboard interaction and full authenticated browser flows remain manual smoke-test items.

Use `LAUNCH_CHECKLIST.md` to finish these checks on the connected environment. Passing isolated tests is not a claim that an unconfigured deployment is ready to accept real students.

## Known operating boundaries

- Images use three deterministic slots. Image replacement and metadata saves span Storage and SQL and are not one cross-service transaction. Failed fresh uploads are removed when possible, and the existing listing ID is retained for retry. An already-existing slot that was replaced is not deleted on a later failure. Old orphan files are handled by the maintenance job.
- Signed image URLs expire after five minutes; moderation does not recall already downloaded data.
- The maintenance function must be deployed and run periodically or scheduled separately.
- Analytics count posted records and self-reported outcomes, not verified payments or a full retention/cohort system.
- Admin Users lists onboarded accounts; accounts which have not completed onboarding can be inspected in the Supabase Authentication dashboard. The total registered-users metric includes Auth users.
- The privacy/terms text needs the actual operator/support contact before public launch.

## Password authentication update

The updated frontend passed 14 unit tests and the strict TypeScript/Vite build. Nine added tests mock Supabase Auth to check password validation, CAPTCHA submission, existing-account recovery without signup, OTP verification, credential-only password updates, errors and redirects. Database migrations are unchanged; the 28 database checks above were run for the original delivery.

The user reports that live OTP delivery, listing creation, session restoration and admin login work in their configured project. Password sign-in and recovery still need live verification after installing this update; the mocked checks do not replace those browser tests. See PASSWORD-UPDATE.md.

## Chat and deletion update

43 embedded PostgreSQL checks and 14 frontend/auth unit tests pass, along with the strict TypeScript/Vite build. The upgrade test starts with the original four migrations, creates users and an ad with images, then applies migration 005 and checks preserved records and the new chat-only contact default. Authorization checks cover participants, phone privacy, blocks, reports, read markers, message limits/pagination, idempotent retries, suspension, and physical message deletion when either owner or administrator deletes an ad. The image policy preserves owner access to staged image slots. No hosted/browser testing was performed. See CHAT-UPDATE.md for installation and live checks.
