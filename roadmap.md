# Roadmap

## Ceyo executable agents
- [x] Make the chat composer smaller and hide its inner scrollbar.
- [x] Update the Composio project key through the secure form; account and tool listing API checks returned 200.
- [x] Fix duplicate thinking loaders and shifting message positions during live sends and history reconciliation; targeted tests passed.
- [x] Add real bot/group creation, role assignment and persistent delegation results to the primary agent.
- [x] Connect Composio account management and integration approval cards inside chat with multiple accounts per app.
- [x] Secure Inngest serving and durable idempotent result delivery; unsigned requests rejected.
- [ ] Inngest synchronization: app.ceyo.si does not resolve, confirmed by Inngest's sync response; publish/connect the domain first. Inline work remains available.
- [ ] Authenticated end-to-end bot creation/delegation and Composio OAuth checks: external unmanaged Supabase provides no test session.
- [ ] Arbitrary code execution/full bot computer: only Browserbase web reading is configured; a code-execution service is not connected.
- [x] Run targeted message, tool-input and steering tests.

- [x] Fix old chat loading character and keep sent messages visible during history refreshes; four targeted tests passed. Authenticated live-chat verification is unavailable for the external unmanaged backend.

- [x] Make the signed-in home a Grok-style bot/group hub with the existing animated characters.
- [x] Add bot/group creation, categories, hidden chats, global search, profiles and editing while preserving real agent chats.
- [x] Verify the new hub on mobile/desktop and run seven targeted tests; authenticated end-to-end coverage remains limited by the external unmanaged backend.

- [x] Redesign Tasks with Orange point icon and five character images; restrict active tasks to the five requested types.
- [x] Remove main Agents +; remove Earn tasks and rename Earn to Referral with Telegram-only invite links.
- [x] Inline manual TON/USDT-TON checkout; strict reference matching and atomic settlement with transaction reuse prevention.
- [x] Synchronize returning Telegram profile photos and fullscreen/safe-area events; native Back navigation.
- [x] Remove visible old sharing/help branding; restore readable shimmering thinking text.
- [x] 13 targeted tests passed; public Tasks and inline Crypto navigation checked on mobile without runtime errors.
- [ ] Real transfer and authenticated read-back: unavailable without a real payment/session; other networks are disabled pending reliable verification.
- [ ] X follow and ORANGE purchase rewards: require X account verification and cryptographic wallet ownership proof; opening links never grants points.
- [ ] Verify fullscreen, native Back and profile image inside an actual Telegram client.

- [x] Rename Megsy/Nova AI → Orange AI (UI + translations + support links @Torekr)
- [x] Telegram login (Mini App initData → session) + /api/public/telegram-auth
- [x] Reward tasks migration (telegram_join, daily_checkin; old Trustpilot/X tasks deactivated)
- [x] /tasks page — server-verified completion, credits awarded by /api/tasks/complete
- [x] Telegram button on the sign-in page
- [x] Crypto wallet addresses saved as secrets (TON / ETH / BSC / SOL / TRON)
- [x] crypto_payments migration
- [x] /api/crypto/invoice — invoice creation + on-chain verification + fulfilment
- [x] Legacy crypto page now uses the manual panel; current checkout keeps crypto inline.
- [x] Bot /start auto-link: webhook route deployed and registered (verified via getWebhookInfo)
- [x] New bot token: TELEGRAM_BOT_TOKEN secret replaced
- [x] Bot admin panel /101 — user count + add/edit/delete tasks (name, link, image)
- [x] Bot /start welcome image + two daily channel posts (English, bold captions, Open Orange AI button) + admin "post now" button
- [x] Orange AI logo + favicon/icons applied from the uploaded circular logo
- [x] reward_tasks image_url column + tasks UI shows task image
- [ ] Additional payment networks require transaction-specific secure verification; wallet-connect is no longer requested.
- [ ] Publish (Vercel token exposed in chat — do not use; publish via Lovable instead)

- [x] Start message rewrite (bold, characters, community + buy ORANGE buttons), daily user notifications, Telegram-only login, full-screen Mini App with top safe area
- [ ] Confirm /start and daily notification in real Telegram
- [x] Short start message + characters image, fixed broken images on Vercel, tasks (channel/X/ORANGE) with verification, Telegram Back button, crypto replaces Google Pay
- [ ] Bot must be admin in @oraien for channel-join verification
- [x] Tasks entry in app menu, real full screen, Telegram back button, crypto page Buffer crash, start image characters together, combined crypto icon
- [x] Tasks page: compact rows (image, name, Go button)
- [x] Telegram profile photo not showing
- [x] Chat thinking text not showing
- [x] Remove two extra buttons next to copy/like/dislike in chat
- [ ] Real TON/USDT wallet payment test (needs user's wallet)
- [x] New tasks added via bot appear in the app tasks page (allowlist removed, image_url used)
- [x] Regenerated 5 task images sized for small circular rows
- [x] Welcome post published to channel (msg 375, button opens Mini App via t.me/Noveaibot?startapp)
- [x] Channel post button opens Mini App
- [x] Deleted 10 oldest Vercel projects (all 204)
- [x] Vercel account blocked (fair use) — published on Lovable instead: https://nova-quest-rewards-hub.lovable.app
- [x] Updated all links (manifest, bot, TON payment, slides) to the Lovable URL
- [x] Webhook + menu button re-registered with secret token; /start verified (200 ok)
- [x] Telegram sign-in race fix shipped in this publish
- [x] One-off channel post scheduled for 2026-10-24 02:00 UTC (fires on next bot traffic)

## Ceyo full rebuild
- [x] Fix settings scrolling on mobile and verify the full settings list can reach its footer.
- [x] Match the settings home, Account, Usage and Vault screens to the supplied references.
- [x] Add Bot Computer and Permissions screens with persistent local rules.
- [x] Finish Devices, Import Memory, Appearance and Language controls.
- [x] Verify all settings screens and local interactions on a 390px mobile viewport with no page errors.
- [ ] Bot Computer reset requires a connected backend computer; permission rules currently persist locally and authenticated memory/device actions need a real external session.
- [x] New Ceyo landing page
- [x] Remove all old pages from the app; rename to Ceyo, English UI, no "AI" wording

## Group chat (Grok-style)
- [x] Chat screen: floating header pill, bubbles per bot, mentions, working line, error toast, swipe for times
- [x] Long-press message sheet: reactions, reply, mark unread, copy, select, request ID, report
- [x] Find in chat bar
- [x] Group profile, Routines, Library, Members, Edit name, Avatar (upload; generate not connected)
- [x] Smoother page-open animation

- [x] Ceyo: black sign-in, redesigned verification-code screen, Megsy text replaced, old unreachable pages removed.
- [x] Compact pricing, bot edit voice/speed/language, bot profile Computer/Notifications/Share as Template, chat + attachments menu, faster bottom-sheet page opens.
- [ ] Replace Primary Bot: needs backend support to change the primary bot.
- [ ] Sending attached files to bots: only file names are sent until upload is connected.
- [x] Remove New conversation from chat + menu.
- [x] Polish edit-bot fields and pricing; stop preloading and delete all remaining old pages and their unused code.

- [x] Clean unused files; integration + question cards in chat.
- [x] Mic recording animation; empty composer shows voice-call button (1:1 chats only) with Grok-style call bar.

- [x] Subscription management page (Premium): Google Play manage/cancel + change plan.
- [x] Clone legal + docs pages into Ceyo: grok-bot terms, X subscription terms, privacy policy, docs overview (https://cursor.com/en-US/terms/grok-bot, https://x.ai/legal/x-subscription-terms-of-service, https://x.ai/legal/privacy-policy, https://docs.x.ai/grok-bot/overview).

- [x] Deep clean: removed Megsy referral pages/assets, invite-code logic, old notes; new clean database tables (profiles, roles, bots, groups, chats, settings)
- [ ] Remove unused old server functions (payments/media) — blocked by tool restriction
- [ ] App still reads the old backend address; reconnect the Supabase project in Lovable settings
