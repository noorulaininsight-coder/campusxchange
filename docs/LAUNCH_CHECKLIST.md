# Live launch verification

These checks require the connected Supabase project and two real approved university email accounts. The isolated SQL tests do not send email or invoke the hosted Storage API.

## Configuration

- [ ] Apply all five SQL migrations in order to a new project. Existing installations apply only migration 005 for this update.
- [ ] Confirm RLS enabled on every application table and both Storage buckets private.
- [ ] Enable the Before User Created hook and email confirmation.
- [ ] Enable Supabase Turnstile CAPTCHA, correct widget hostname and matching key pair.
- [ ] Verify Resend sender DNS, custom SMTP and branded token email templates.
- [ ] Set OTP expiry to 10 minutes and request cooldown to at least 60 seconds.
- [ ] Confirm the university domain against a real student's email address.
- [ ] Set frontend public environment variables and production Site URL.
- [ ] Bootstrap only the intended administrator after onboarding.
- [ ] Add actual operator/support contact and review policy text.

## Account and OTP

- [ ] Guest can browse but cannot contact, post, save or report.
- [ ] Approved inbox receives real code; incorrect/expired codes show errors.
- [ ] Resend waits for cooldown and renewed CAPTCHA.
- [ ] Gmail or suffix-spoof email is rejected by a direct Auth signup request.
- [ ] Direct Auth request without valid CAPTCHA is rejected.
- [ ] New user completes onboarding; refresh restores profile and session.
- [ ] Duplicate registration number fails without exposing database details.
- [ ] Registration, email, contact and moderation fields absent from public profile query.

## Listings

- [ ] Create sale, rental and request with valid mutually exclusive amounts.
- [ ] Upload 1–3 JPEG/PNG/WebP source photos; final stored images are compressed WebP.
- [ ] Fourth photo, malformed path, cross-owner file writes and oversized uploads fail.
- [ ] Preview/reorder/remove images; edit existing listings including replacement photos.
- [ ] Interrupt an upload; verify retry edits the existing listing without duplicates.
- [ ] Search title/description/category; filter condition, category, campus and amounts.
- [ ] Test newest/amount sorts, pagination, zero matches and clearing filters.
- [ ] Saved items persist after reload; duplicate save is prevented; unsave works.
- [ ] Another active student can chat; WhatsApp/Call contact is available only for the modes enabled by the listing owner.
- [ ] Rental deposit/payment disclaimer and safety notice are visible.
- [ ] Complete/archive each type with appropriate reason. Record disappears from public feed and telemetry is recorded once.
- [ ] Non-owner cannot edit/resolve via direct API request.

- [ ] Run the two-account chat/block/report/deletion checklist in CHAT-UPDATE.md.

## Reports and administration

- [ ] Report a user and listing; other users cannot read reports/internal notes.
- [ ] Admin sees counts, registered student profiles, listings, reports and history.
- [ ] Admin changes report state/notes; action appears in audit log.
- [ ] Suspend/reject requires a reason; current suspended session immediately loses protected backend operations.
- [ ] Account holder sees moderation reason; reactivation restores access.
- [ ] Removed listing cannot be edited or restored by its author.
- [ ] University/campus/domain can be added; inactive configuration blocks signup and member actions.
- [ ] Cannot disable acting administrator's own configuration through admin UI.
- [ ] Domain reassignment is disallowed; create a new domain record instead.
- [ ] Charts match known completion reasons/category counts.
- [ ] Deactivation hides student profile/listings and blocks protected operations.

## Hosting, accessibility and maintenance

- [ ] Run `npm run build`, `npm test`, `npm run test:db`.
- [ ] Refresh nested Pages routes, including `/listing/<id>` and `/admin`.
- [ ] Check network/browser console for API, CSP and JavaScript errors.
- [ ] Test 360px, tablet and desktop widths with real content and long names/titles.
- [ ] Navigate menu, filters, forms and dialogs with keyboard; Escape closes dialogs and focus returns.
- [ ] Test sign-out on shared devices; no other user's cached profile/contact is shown after switching accounts.
- [ ] Deploy cleanup Edge Function with exact APP_ORIGIN.
- [ ] Invoke without credentials/non-admin: denied. Active admin: allowed.
- [ ] In a test project, verify orphan (>1 day) and closed listing (>90 days) images are deleted; active images retained.
- [ ] Schedule cleanup or document who runs it regularly; monitor provider quotas.
- [ ] Record the production version and keep an appropriate backup/recovery process.
