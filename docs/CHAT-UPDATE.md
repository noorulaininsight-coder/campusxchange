# Chat, optional contact and ad deletion — update guide

This update builds on the password-login release. Existing accounts, passwords, administrator roles, listings, reports and images are preserved. No new npm dependencies, email templates, API keys or environment variables are required.

## Install on your existing deployed project

1. Back up your local project. Keep `.env.local` private. Extract this ZIP into a separate folder so it does not overwrite your configuration accidentally.
2. Open the extracted file `supabase/migrations/202610040005_chat_and_deletion.sql` in VS Code. Copy its complete contents.
3. In your **existing Supabase project**, open SQL Editor → New query. Paste the file and run it **once**. Run only this new file; do not rerun migrations 001–004, recreate your project or delete users. The file uses a transaction: an error rolls back the upgrade. If there is an error, keep the old frontend deployed and share the error text before retrying. If the migration already succeeded, do not rerun it.
4. Copy the updated `src`, `supabase`, `scripts` and `docs` folders plus `README.md` into your existing local project, choosing Replace. Keep `.env.local`, your Git repository and existing hosting settings. Your package/lock files do not need to change for this update.
5. In VS Code's project terminal run:

   ```bash
   npm run build
   npm run dev
   ```

6. Test locally using the two existing accounts and the checklist below. Use disposable test ads for deletion; chat deletion cannot be undone from the app.
7. Review `git status` to ensure `.env.local` and credentials are absent. Stage the update and push:

   ```bash
   git add src supabase scripts docs README.md
   git commit -m "Add in-app chat, optional contact and ad deletion"
   git push
   ```

8. Your connected Cloudflare Pages project should build the pushed production branch. After deployment succeeds, refresh the live site and repeat the two-account checks. No Cloudflare build-setting change or Supabase Realtime publication setup is needed.

Apply SQL before deploying the new frontend. During the brief gap, old pages may display a contact error because existing ads switch to private chat by default. Refresh after deploying. Do not revert to the old frontend as a long-term rollback: its UI does not support the new privacy modes.

## What changes

### Chat and contact

- Every active ad supports in-app text chat for active, onboarded students other than its owner.
- One conversation per ad and interested student; an owner can have separate conversations with different students.
- Navigation includes Messages and an unread-message count. An open thread refreshes every 3 seconds, the inbox every 5 seconds and the navigation count every 15 seconds while the app is in the foreground. There are no browser push/email alerts or attachments in this release.
- Message history loads in pages of 50; inbox pages contain 30 conversations.
- New **and existing** ads default to **chat only**. Owners can edit an active ad and choose chat only, chat + WhatsApp, chat + Call, or all three. WhatsApp/Call use the number already saved in the profile; WhatsApp also reveals that number.
- The backend rejects phone requests for chat-only ads. Numbers already seen or copied cannot be recalled. Profile phone collection remains unchanged and admins retain private-contact access for moderation.
- Block applies to both directions across ads, stops new messages/new conversations and disables phone lookup between those users. Only the person who created a block can remove it. The Blocked students section remains available even after an ad and its chats are deleted.
- Chat reports go to **Admin → Reports** as HARASSMENT with the reporter's description and ad/conversation IDs. Admins can moderate the reported student. There is no general admin inbox access to private message bodies; the report does not copy the message transcript. Reports are retained even when the ad's messages are deleted.
- Plain text is displayed as text, not rendered HTML. Messages are limited to 2,000 characters, 30 per minute and 200 per hour per sender. New conversations are limited to 20 per hour. Limits are enforced by SQL; repeated sends with the same request ID do not create duplicate messages.

### Ad deletion

- **My campus → My listings/My requests → Delete ad** requires a reason of 5–2,000 characters and explicitly confirms deletion of all chats.
- **Admin → Listings / Reports → Delete listing** requires a reason and uses the same deletion workflow.
- Deletion hides the ad from public browsing and the owner's normal list, clears saved-item references, and physically deletes **all conversations and messages for that ad** in the same database transaction.
- The ad record, removal reason and audit event remain for moderation. This is not a full purge of all ad data. Owners see recent administrator removal reasons in My campus. Deleted ads cannot be restored through editing.
- Previously loaded chat screens disappear on the next successful refresh (normally within 3 seconds while open); copies/screenshots and provider backups cannot be recalled.
- Mark completed / Archive remain separate actions. They close messaging but keep past chat history. Only **Delete ad** deletes chats.
- Listing images retain the existing maintenance policy: closed images become eligible after 90 days and need the existing maintenance job to run. Signed image links already issued may work until their short expiry.

## Two-account live checklist

1. Account A: create a disposable **chat-only** ad. Account B: open it; only the in-app Chat action should appear, with no WhatsApp/Call button.
2. B sends a message; A sees it in Messages and an unread count. Open the thread as A and reply. B should receive the reply automatically. Refresh and confirm history persists.
3. Edit the ad as A and test WhatsApp-only, Call-only and Both. Refresh B's listing page after each change. Switch back to chat-only and confirm the external-contact action disappears.
4. A blocks B; B cannot send and A cannot send until A unblocks. B cannot remove A's block. Unblock from the thread or Blocked students.
5. B reports the chat with a clear reason. In the admin account, confirm the report appears with the description and reported student.
6. Create a third chat if another test student is available. An unrelated account must never see other students' inbox conversations.
7. A deletes the test ad with a reason. Confirm the ad is gone from Explore/My listings and **both accounts' conversations disappear**, including after refresh. A direct old chat URL must show unavailable.
8. Repeat with a second disposable ad, deleting it as admin. Confirm the seller can see the removal reason and chats are gone for both participants.
9. Check existing password sign-in, original ads, images, profile/settings and `/admin` still work, including on mobile.

## Verification

- Strict TypeScript and Vite production build.
- 14 existing frontend/auth unit tests.
- 43 SQL authorization/workflow checks in embedded PostgreSQL, including upgrading a database containing users/listings/images, protected contact modes, participant-only chat, read counts, retry deduplication, blocking, reports, suspension, cursor pagination, rate limits, owner/admin deletion and message cascades.

These are isolated checks, not a claim of live Supabase/browser testing. No credentials were used and this ZIP does not change your deployed project until you apply it. Run the live checklist after deployment.
