# Password login update — existing installations

Your current Supabase project, verified users, profiles, listings and ADMIN role stay in place. This update changes the frontend authentication experience; it does not recreate accounts or tables.

## Apply this update on Windows

1. Stop the Vite terminal with Ctrl+C.
2. Keep a backup of your current project folder and `.env.local`.
3. Extract the updated ZIP somewhere separate.
4. Copy the updated `src` folder into your existing `campusxchange` folder and choose **Replace files**. Also copy the updated `docs` folder and `README.md` for reference. If you have independently edited application code, compare those files before replacing them.
5. Keep your current `.env.local`. It contains your working project URL, public key and Turnstile site key. Do not replace it with placeholders.
6. **Do not rerun the old SQL migrations. Do not delete Auth users. Do not change working SMTP or CAPTCHA credentials.** No new migration or npm dependency is required by this update.
7. Restart with `npm run dev` and refresh the browser. Use the same localhost hostname and port.

## Set a password for your current admin account

1. If already logged in, open **My campus → Edit profile → Set / change password**. You can also open `http://localhost:5173/password` using your actual development port.
2. Enter a unique password/passphrase of at least 12 characters and confirm it.
3. Save. A success screen confirms the credential was saved by Supabase.
4. Continue to your account. Sign out once, then sign in with the **same university email and your new password**.
5. Confirm `/admin` still opens and your existing listing is still visible.

If you are logged out and have never set a password, select **Forgot password** (or the **Previously used email codes?** link). Verify the OTP for your existing university email and set the password. This recovery path sets `shouldCreateUser: false` and cannot create a replacement account.

## Supabase settings

Keep your working email provider, confirmed-email requirement, university-domain hook, SMTP and CAPTCHA setup enabled. Email/password authentication uses the same Supabase Email provider; no separate database password table is needed.

In Authentication's password/security settings, set the **server-side minimum password length to 12** to match the new form. The form accepts passphrases up to 128 characters; a stricter server policy will still be enforced by Supabase. Keep rate limits and CAPTCHA enabled for password sign-in as well as email-code requests.

Keep the numeric `{{ .Token }}` content in the **Magic Link** and **Confirm signup** email templates. Both signup and account recovery use an email OTP followed by an authenticated password update. Recovery does not use a reset link or require a reset-password callback URL.

If **Secure password change** is enabled and Supabase requests reauthentication for an older session, the password page offers **Send confirmation code**. Keep the **Reauthentication** template enabled with `{{ .Token }}` so this additional code can be delivered. Alternatively, sign out and use Forgot password to establish a fresh verified session. Do not disable the security setting just to bypass a reauthentication error.

## Expected flows

| Person / action             | Flow                                                                         |
| --------------------------- | ---------------------------------------------------------------------------- |
| New student                 | Create account → university-email OTP → set password → profile onboarding    |
| Existing student            | Sign in → university email + password → dashboard or intended page           |
| Existing OTP-only account   | Verify existing email through Forgot password → set password on same account |
| Forgot password             | Email OTP for an existing account → choose a new password                    |
| Logged-in account           | Settings → set/change password                                               |
| Valid saved browser session | Sign-in page automatically redirects to the account                          |

An OTP is no longer required for normal password sign-in. CAPTCHA still applies. A user who has access to their verified inbox can recover the account. The app never stores passwords in profiles, private-contact rows, local storage, user metadata or audit logs; Supabase Auth manages credentials.

## Test after updating

- Sign in as the existing admin, set a password, sign out and sign back in with it.
- Try an incorrect password and confirm a readable error.
- Verify a normal new tab at the same origin restores the existing session.
- Test Forgot password with your existing account; the same profile, listing IDs and admin role should remain.
- Request recovery for an unused university address in a test environment and check that no Auth account is created.
- Test a second student's new signup: verify OTP, set password, complete onboarding, sign out and sign back in.
- Confirm CAPTCHA verification and server password policy remain active.

## Verification performed for this code update

Strict TypeScript/Vite build and unit checks were run. Auth request tests use mocked Supabase responses to verify account-creation flags, credential-only updates, failure handling, CAPTCHA submission and redirect logic. They do not simulate email delivery, hosted password hashing or a complete browser login. You must perform the live steps above on your configured Supabase project. The existing database schema and RLS are unchanged.
