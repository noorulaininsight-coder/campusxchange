# CampusXchange architecture

React/Vite is a static SPA on Cloudflare Pages. Supabase Auth sends signup/recovery OTP through the configured SMTP provider and validates Turnstile. Returning users use email/password authentication; credentials remain managed by Supabase Auth. The browser holds only a publishable key and the user's session. PostgreSQL is the source of truth for eligibility, roles, ownership, campus membership and moderation. Future Expo clients can call the same RPCs and tables.

## Folder structure

- `src/components/`: reusable layout, cards, forms, accessible dialogs and shadcn-style primitives
- `src/pages/`: landing, authentication, onboarding/profile, marketplace, detail, editor, dashboard, public profile, admin, legal
- `src/hooks/`: auth session and query lifecycle
- `src/lib/`: Supabase client, API functions, types, validation and image utilities
- `supabase/migrations/`: ordered schema, security, functions and seed configuration
- `supabase/functions/cleanup-images/`: authenticated administrative storage retention job
- `scripts/test-db.mjs`: executable Postgres authorization and lifecycle tests using PGlite
- `docs/`: setup, architecture, deployment and launch verification

## Data boundaries

`profiles` contains only safe public fields. `user_accounts` contains role, moderation status and private student identifiers. `user_private_contacts` contains phone numbers. Self/admin reads are allowed on private records; other students obtain a single eligible seller's contact only through `get_listing_contact`. There is no directory of phone numbers. Public records are readable only when the owner and campus remain active. Anonymous browsing is intentional; suspended accounts cannot perform protected operations even with an old JWT.

## Writes and authority

Normal clients cannot directly mutate roles, profiles, listings, reports or moderation logs. Narrow SECURITY DEFINER RPCs use a fixed search_path, derive identity from auth.uid(), validate inputs and check current account state on each call. RLS applies to every table. Grants are revoked first, then explicitly allowed. Only RPCs exposed in the migration are executable by client roles. Storage has owner-specific policies and a server-side three-object limit through three deterministic slot names.

Listing completion and its mandatory resolution telemetry are one transaction with a row lock, preventing double completion. Listing authors cannot resurrect an admin-removed record. Admin actions require an active ADMIN database record and append an audit record in the same transaction. No public admin signup exists.

## Campus lifecycle

The domain hook checks university, campus and domain activation at signup. Membership is assigned from the authenticated email by the backend, never client-selected. All protected actions also check the active configuration. Disabling a campus, university or domain revokes protected access for affected members. Domains are unique and cannot be reassigned after creation; changing a domain requires a new record. This prevents silent migration of existing students.

## Images

Private Storage buckets use signed URLs; active listing image reads are public by policy, but direct object URLs are not public. Owners can read their archived images and admins can moderate. Three deterministic slots per listing are enforced in SQL. Images are decoded and redrawn in a browser canvas (removing metadata), converted to WebP and limited to 350 KB; uploads have server limits too. SQL validates image path ownership. Upload failures clean up newly uploaded slots; successful edits remove unreferenced slots. A separate server job cleans old orphans and images of records archived/completed/removed over 90 days ago. It deletes files through the Storage API, not storage metadata SQL.

## External configuration

The project cannot deliver OTP until Supabase, Resend DNS/SMTP and Turnstile are configured. No credentials are fabricated. The UI displays an honest setup screen when Supabase variables are missing. No fake account login, fake metrics or demo listings are used in production.

## Password authentication update

The signup screen requests an email code and routes the verified session to `/password` before profile onboarding. Returning users use `signInWithPassword`. Recovery uses `signInWithOtp` with `shouldCreateUser: false`, then `verifyOtp`, then an authenticated `updateUser({password})`. This preserves the existing Auth user ID and every profile/listing/role relationship. Passwords and credential-presence flags are not stored in application tables or user metadata. Existing confirmed sessions can set/change their password in settings, with a reauthentication code handled when Supabase requires it.

## Chat and removal update

Migration 005 adds private conversations/messages/blocks tables with RLS and no client table privileges. Security-definer RPCs with fixed search paths derive identity from auth.uid(), check active membership and participants, and enforce bounded pagination and sender limits. The client polls threads/inbox rather than requiring Realtime publication. Listing and pair advisory locks serialize sends/starts against deletion and blocking. A sender lock serializes cross-conversation rate checks; client request IDs deduplicate retries. Read markers advance only to an existing message in the participant conversation.

Public listing contact_mode defaults to CHAT. The existing contact RPC checks this setting and block status before returning a private number. Deletion requires owner/admin authority and a reason, retains the listing/removal audit, clears wishlist entries and cascades conversation deletion to messages atomically. Existing admin_moderate calls delegate to this deletion path. Chat reports use existing user-report moderation, with no transcript copies; administrators do not get general chat read access. Completed/archived ads keep read history but cannot receive messages. Deleted ads have no chat history in the active database.
