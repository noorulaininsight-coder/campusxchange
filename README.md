# Latest update: chat and ad deletion

For your existing deployed installation, follow [docs/CHAT-UPDATE.md](docs/CHAT-UPDATE.md). Run only the new `202610040005_chat_and_deletion.sql` migration before deploying the updated frontend. Existing ads become chat-only until their owners enable WhatsApp/Call.

# CampusXchange

**Existing installation?** Start with [Password login update](docs/PASSWORD-UPDATE.md). Copy the updated source into your existing project, preserve `.env.local`, and do not rerun the original SQL migrations.

A campus marketplace with three modules: **Buy & Sell**, **Rentals**, and **Requests**. New students verify their university email by OTP, set a password, complete their profile and connect through in-app chat, with optional WhatsApp or phone. Returning students sign in using email and password. Includes a separate administrator dashboard, moderation, reports, analytics and audit history.

**Delivery state:** Application source and Supabase migrations are implemented. You must connect your own Supabase, Resend and Turnstile accounts before real authentication works. Cloudflare hosting is prepared but is not deployed by this ZIP. Read `docs/VERIFICATION.md` for precisely what was tested and what still needs a live smoke test.

No fake login, fake transaction metrics, payments, escrow, delivery or mobile application are included.

## Start here, Farhan

Aapko manually accounts aur unki settings configure karni hain. App ka code, database SQL, admin functionality aur deployment files ready hain. Pehle local app open kar lein, phir neeche diya gaya Supabase → Resend → Turnstile setup complete karein. **Passwords, SMTP/API secrets ya service-role key chat mein share na karein.** Apne dashboard/environment mein enter karein.

### 1. Open the project on Windows

1. Install a currently supported Node.js LTS version, version 22 or newer, from [nodejs.org](https://nodejs.org/). Keep npm selected in the installer.
2. Extract the ZIP. Open the inner `campusxchange` folder in VS Code. You should see `package.json` at the top level.
3. In VS Code select **Terminal → New Terminal**. Use **Command Prompt** if PowerShell blocks `npm.ps1`.
4. Run:

```bash
npm ci
npm run dev
```

5. Open the localhost URL printed in the terminal, normally `http://localhost:5173`.
6. You can see the landing page. Marketplace/sign-in will show setup guidance until the backend is configured. Keep the terminal running. Press `Ctrl+C` to stop it.

If you see `ENOENT package.json`, you opened the parent folder. Run `cd campusxchange` or open the folder that contains `package.json`.

### 2. Create the Supabase project

1. Open [Supabase Dashboard](https://supabase.com/dashboard), sign in and create a **new empty project**. Do not apply this schema to an unrelated existing application.
2. Choose your organization, name the project `CampusXchange`, select a suitable nearby region and save the database password privately.
3. Wait for project initialization. Find the project URL and **publishable** key in the project connection/API settings. A legacy `anon` key also works. Do not use `service_role` or an `sb_secret_...` key in the browser.
4. Open **SQL Editor → New query**. Run these files, one at a time, in this exact order. Open each in VS Code, copy the complete contents, paste and click **Run**:

| Order | File                                               |
| ----- | -------------------------------------------------- |
| 1     | `supabase/migrations/202610030001_core.sql`        |
| 2     | `supabase/migrations/202610030002_storage.sql`     |
| 3     | `supabase/migrations/202610030003_analytics.sql`   |
| 4     | `supabase/migrations/202610030004_maintenance.sql` |
| 5     | `supabase/migrations/202610040005_chat_and_deletion.sql` |

These are first-install migrations, not repeatable setup scripts. Once a file succeeds, move to the next. If a file fails, its transaction rolls back; fix the reported issue and retry that file. Do not delete existing data or keep rerunning successful files.

5. The setup seeds COMSATS University Islamabad, Lahore Campus, the supplied `cuilahore.edu.pk` domain, nine categories, example meetup spots and marketplace rules. Verify that `cuilahore.edu.pk` is the actual suffix used by your intended students before launch. Adjust the database domain before onboarding if your student email suffix differs; do not add Gmail to production.
6. In the API settings, expose only the normal `public` API schema. **Do not expose `private`, `auth` or `storage` as extra Data API schemas.** Storage uses its own API.

### 3. Enable the mandatory university-domain hook

1. Open Supabase **Authentication → Hooks**.
2. Add a **Before User Created** hook.
3. Choose **Postgres function**, schema `public`, function `before_user_created`.
4. Enable/save it.
5. In Auth email/provider settings, keep email authentication and **email confirmation** enabled. Disable anonymous sign-ins and unused OAuth/phone providers. The application uses email OTP for signup/recovery and email/password for returning users. Set the Auth minimum password length to 12.
6. Set your Site URL to `http://localhost:5173` for initial testing. Replace this with the production URL after deployment; allow localhost as a development redirect only if needed.

The frontend domain check improves the error message. The hook is what stops a direct Supabase request from registering an unauthorized email. SQL onboarding also requires a confirmed approved email, even if the hook is mistakenly omitted.

### 4. Configure real email delivery with Resend

You need a domain whose DNS you control for a production sender. The sender can be `auth@yourdomain.com`; it does **not** need to be the university domain. Student recipient eligibility still comes from the approved university email domain.

1. Open [Resend](https://resend.com/), create your account and open **Domains → Add Domain**.
2. Add a domain or sending subdomain you own, such as `mail.yourdomain.com`.
3. Resend shows the required DNS records. Copy the exact names and values into your domain provider's DNS panel. Do not replace the existing website records. Wait until Resend marks the sender domain verified.
4. Create a Resend API key with the permission needed to send email for that domain. Save it privately.
5. In Supabase **Authentication → Email → SMTP Settings** (dashboard labels can vary), enable **Custom SMTP** and use:

| Setting       | Value                                     |
| ------------- | ----------------------------------------- |
| Sender name   | `CampusXchange`                           |
| Sender email  | An address on your verified sender domain |
| SMTP host     | `smtp.resend.com`                         |
| SMTP port     | `465` (SSL/TLS)                           |
| SMTP username | `resend`                                  |
| SMTP password | Your Resend API key                       |

6. Save the settings. The SMTP password belongs in Supabase settings, not in Vite environment variables or GitHub source.
7. In **Authentication → Email Templates**, replace the **Magic Link** body with `docs/otp-email.html`. Also use the branded token template for **Confirm signup** if that template is used for first sign-ins in your project. Keep the exact `{{ .Token }}` variable. Subject: `Your CampusXchange verification code`.
8. Set email OTP expiry to **600 seconds (10 minutes)**. The form accepts 6–10 digits to support the OTP length configured by your Supabase project. Keep the email expiry text synchronized if you change expiry.
9. Set the per-address request cooldown to at least **60 seconds**. Review Auth endpoint/IP and total email rate limits to fit your SMTP allowance. Do not disable rate limits to fix delivery issues.
10. Test using your real university inbox, including spam/junk. A successful API call alone is not proof of delivery.

Supabase's development SMTP is not a production substitute. Its default delivery restrictions can prevent real students receiving email. Resend test sending is also not a substitute for verified-domain production sending. Check your current provider quotas and DNS requirements rather than assuming an unlimited free email service.

### 5. Configure Cloudflare Turnstile

1. Sign in to [Cloudflare](https://dash.cloudflare.com/) and open **Turnstile → Add widget**.
2. Name it `CampusXchange`. Choose **Managed** mode.
3. Add the hostnames on which the application will run, including your production Pages/custom hostname. Add `localhost` for development if your widget configuration supports it; use Cloudflare's documented test keys only in a development project if necessary.
4. Copy the public **site key** into the frontend environment in step 6.
5. Copy the private **secret key** into Supabase **Authentication → Bot and Abuse Protection / CAPTCHA**. Select Cloudflare Turnstile and enable protection.
6. Never put the secret key in a `VITE_...` variable. Frontend token submission alone does not protect Auth unless CAPTCHA is enabled in Supabase.
7. Verify in your browser that a code request succeeds after the challenge. Verify a direct request without a CAPTCHA token is rejected.

### 6. Connect the frontend

In the project folder, copy `.env.example` to `.env.local`. In Windows Command Prompt:

```bat
copy .env.example .env.local
```

Enter your actual values:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
VITE_TURNSTILE_SITE_KEY=YOUR_PUBLIC_SITE_KEY
```

Restart `npm run dev` after saving. Vite reads environment values when it starts/builds.

| Where                              | Configuration                                                    |
| ---------------------------------- | ---------------------------------------------------------------- |
| Local `.env.local`                 | The three public `VITE_` variables above                         |
| Cloudflare Pages build environment | The same three public `VITE_` variables                          |
| Supabase Auth dashboard            | Resend SMTP password and Turnstile secret                        |
| Supabase Edge Function secrets     | `APP_ORIGIN`; optional `CLEANUP_JOB_SECRET`                      |
| Supabase managed Edge environment  | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |

No service-role, SMTP, database or Turnstile secret belongs in the browser. `.env.local` is ignored by Git.

### 7. Create the first administrator

1. Choose Create account, verify your approved university email by OTP, and set a password.
2. Complete profile onboarding. Your account is initially a normal `STUDENT`. Existing users keep their current role when setting a password.
3. Open Supabase **SQL Editor**. Replace only the example email below with your verified university email. Run:

```sql
update public.user_accounts
set role = 'ADMIN'
where user_id = (
  select id from auth.users
  where lower(email) = lower('YOUR_UNIVERSITY_EMAIL_HERE')
    and email_confirmed_at is not null
);
```

4. Confirm exactly **one row** was updated. If zero rows were updated, check the email and finish onboarding first. Do not promote all accounts.
5. Refresh the app, or sign out and sign back in. Open `/admin`.
6. You now have Overview, Users, Listings, Reports, Campus management, Analytics and Audit log.

Only a trusted project owner should execute this bootstrap SQL. There is no public admin signup and students cannot promote themselves. Admins cannot suspend themselves or deactivate their own access configuration through the application.

### 8. Test the actual student workflow

Use two real approved university accounts, one of which is the admin. Follow `docs/LAUNCH_CHECKLIST.md`. Test one sale, one rental and one request; photo upload/edit; save/unsave; contact links; reports; completion/archiving and moderation. Test desktop and mobile widths. Confirm logged-out users cannot fetch contacts.

Do not launch to students before real OTP, CAPTCHA and hosted RLS/Storage behavior pass these checks.

### 9. Push to GitHub

Create an empty private GitHub repository named `campusxchange`. In the project terminal:

```bash
git init
git add .
git commit -m "Build CampusXchange MVP"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/campusxchange.git
git push -u origin main
```

If Git asks for identity, configure your own name/email. GitHub may open a browser for authentication. Do not paste tokens into source files.

Before pushing, use `git status` and ensure `.env.local` is not staged. If the project was already initialized, do not repeat `git init`/`remote add`; use its existing remote.

For later updates:

```bash
git add .
git commit -m "Describe your change"
git push
```

### 10. Deploy to Cloudflare Pages

1. In Cloudflare, create a **Pages** project and choose **Connect to Git**.
2. Authorize your GitHub account and select the `campusxchange` repository.
3. Production branch: `main`.
4. Build settings:

| Setting                | Value                                                                    |
| ---------------------- | ------------------------------------------------------------------------ |
| Framework preset       | Vite (or None with the settings below)                                   |
| Build command          | `npm run build`                                                          |
| Build output directory | `dist`                                                                   |
| Root directory         | Blank if `package.json` is at repository root; otherwise `campusxchange` |
| Node version           | `22` or newer supported LTS, set `NODE_VERSION` if needed                |

5. Add all three `VITE_` public environment variables. Put them in the production environment; add them to previews only if you intend previews to use that backend. Prefer a separate development backend for previews.
6. Deploy and copy the resulting `https://...pages.dev` address.
7. Add this exact hostname to Turnstile. Set the Supabase Site URL to the production origin.
8. If using a custom domain, add it in Pages and update Turnstile/Supabase accordingly.
9. Open `/marketplace` directly in a new browser tab and refresh a nested listing route. `public/_redirects` provides SPA fallback. `public/_headers` sets baseline security headers. If using a custom Supabase API domain, update the CSP domain allowlist in `_headers` before building.
10. Subsequent GitHub pushes trigger automatic builds. Database migrations are separate: apply new SQL migrations in order before publishing code that depends on them.

### 11. Deploy image maintenance

The maintenance Edge Function removes unreferenced uploads older than one day and images belonging to archived/completed/removed listings older than 90 days. It keeps listing records and telemetry. It processes at most 500 files per call; repeat if `hasMore` is true.

Install/use the Supabase CLI through its documented installation method. With Node/npm available, the commands below use `npx`:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase secrets set APP_ORIGIN=https://YOUR_SITE.pages.dev
npx supabase functions deploy cleanup-images --no-verify-jwt
```

The function verifies a real active administrator JWT internally, or a dedicated scheduled-job secret. `--no-verify-jwt` disables only the gateway check, not application authorization. Do not remove the checks in the function.

For manual maintenance, sign in as administrator and run **Admin → Overview → Run image cleanup** after deploying the function.

For daily automated cleanup, set a long random `CLEANUP_JOB_SECRET` in Supabase Edge secrets and configure a trusted scheduler to make an HTTPS POST to:

```text
https://YOUR_PROJECT.supabase.co/functions/v1/cleanup-images
```

Add the server-side `x-cleanup-secret` header containing that secret. Keep it in the scheduler's secret store, not in frontend code. A daily schedule is appropriate; monitor failures and free-tier quotas. No scheduler is created automatically by this project. If you do not configure one, run the administrator cleanup periodically.

## Commands

| Command           | Purpose                                                                  |
| ----------------- | ------------------------------------------------------------------------ |
| `npm ci`          | Install exact versions from lockfile                                     |
| `npm run dev`     | Local development                                                        |
| `npm run build`   | Strict TypeScript checks + production build                              |
| `npm run preview` | Serve the production build locally                                       |
| `npm test`        | Validation/contact unit checks                                           |
| `npm run test:db` | Execute migrations and authorization tests in isolated embedded Postgres |

## Architecture and stack

React, Vite, TypeScript, Tailwind CSS, Radix/shadcn-style accessible primitives, React Router, React Hook Form, Zod, TanStack Query, Lucide and Supabase JS. Backend: Supabase PostgreSQL, Auth, private Storage buckets, secured RPC functions and one maintenance Edge Function. No Express or Next.js server.

See `docs/ARCHITECTURE.md` for folders, data boundaries, lifecycle and future Expo compatibility. Components in `src/components/ui` are checked into the project so you can customize them.

All tables have RLS. Only narrow RPCs modify protected business data. Every privileged RPC derives actor identity from `auth.uid()` and checks live database roles/status. Student identities, campus and role are not trusted from submitted JSON. Private contacts are separated from safe public profile fields. Reports and telemetry cannot be read by other students. Owner actions archive records instead of hard deleting them.

## Development data

Migrations seed only configuration, not fake production students or listings. For an isolated test Supabase project, `scripts/seed-demo.mjs` creates clearly labeled demonstration records using a server-only service-role key. See the script header. Never run it against production. The database test suite independently creates in-memory fixtures and does not connect to your actual project.

## Troubleshooting

| Problem                                            | What to check                                                                                                                        |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Setup screen                                       | `.env.local` is in the same folder as `package.json`; variables have the exact names; restart Vite                                   |
| OTP never arrives                                  | Custom SMTP, verified sending DNS, sender address, email template, rate limits and spam folder; check Supabase Auth and Resend logs  |
| New signup fails                                   | Hook is enabled, actual email suffix matches an active domain, campus and university are active                                      |
| Old account can sign in but cannot use marketplace | Account status or campus/domain activation changed; admin must inspect it                                                            |
| CAPTCHA fails                                      | Site hostname is allowed, browser site key matches Supabase secret key, CAPTCHA provider is Turnstile                                |
| Code invalid/expired                               | Use the most recently requested code before expiry; request a fresh code after cooldown                                              |
| Avatar/image fails                                 | Apply storage migration, keep buckets private, use JPEG/PNG/WebP under 12 MB before compression; final uploaded WebP must be ≤350 KB |
| Three replacement photos fail                      | Remove/retry photos; failed uploads do not require posting duplicate listings. The form retains the created listing ID for retry     |
| Duplicate registration                             | Your campus registration number must be unique; ask the admin to inspect duplicate accounts                                          |
| Admin page denied                                  | Complete onboarding, promote the exact user in trusted SQL, refresh session; account and campus must be active                       |
| Cleanup fails                                      | Deploy the function, set exact `APP_ORIGIN` without trailing slash, use active admin account; inspect Edge Function logs             |
| Nested URL 404                                     | Build `dist` with `_redirects`; verify Pages is serving the correct output folder                                                    |
| SQL `already exists`                               | A migration has already run; continue with the next unapplied migration                                                              |
| npm PowerShell policy error                        | Select Command Prompt terminal or run `npm.cmd` rather than changing system policy                                                   |

## Operating notes

Set a real operator/support contact in the published policy pages before public launch. The included privacy/terms text describes the implementation and should be reviewed for your actual operating policies. Keep backups appropriate to your provider plan. Monitor database, image-storage and email usage; free tiers have limits and are not an uptime guarantee. Current implementation records listing resolutions and category/module activity, not verified payments, unique contacts or a full user-retention analytics suite.

Signed image URLs can remain usable for up to five minutes after moderation; previously downloaded images/phone numbers cannot be remotely recalled. Replacing a photo in one of the three fixed slots can update that photo before the text save completes; retrying completes the listing edit. Metadata-only edits and completion telemetry are database transactions.

## Official setup references

- [Supabase Before User Created hook](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook)
- [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Supabase CAPTCHA / Turnstile](https://supabase.com/docs/guides/auth/auth-captcha)
- [Resend SMTP settings](https://resend.com/docs/send-with-smtp)
- [Cloudflare Pages Vite deployment](https://developers.cloudflare.com/pages/framework-guides/deploy-a-vite3-project/)

Provider dashboard labels and plan limits may change; the official references are the source of truth.
