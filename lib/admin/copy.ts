// Every shared admin UI string, by key (admin-ux §12). One place for the "Haven team" voice and
// ready for Phase 2 translation. Warm, plain, sentence case; no exclamation marks or jokes in
// Safeguarding, Finance, confirmations and errors. Placeholders use {name}.

export const COPY = {
  /* Identity */
  "app.name": "Haven team",
  "app.titleTemplate": "%s · Haven team",
  "app.skipLink": "Skip to content",

  /* Shell */
  "shell.find": "Find",
  "shell.findHint": "Find or do anything · Ctrl K",
  "shell.findPlaceholder": "Find a person, a reference, a page… or type an action",
  "shell.new": "New",
  "shell.newTitle": "What would you like to do?",
  "shell.updates": "Updates",
  "shell.markAllRead": "Mark all as read",
  "shell.places": "Places",
  "shell.more": "More",
  "shell.me": "Me",
  "shell.help": "Help",
  "shell.textSize": "Text size",
  "shell.textNormal": "Normal",
  "shell.textLarge": "Larger",
  "shell.tour": "Take the tour",
  "shell.signOut": "Sign out",
  "shell.back": "Back",
  "shell.newArrivals": "{count} new items arrived",
  "shell.show": "Show",

  /* Ribbons */
  "ribbon.practice":
    "Practice mode · Everything is saved on this computer only, and emails wait in the Outbox instead of being sent.",
  "ribbon.practiceAction": "Open Outbox",
  "ribbon.stripeTest": "Card payments are in test mode. Test gifts are not counted in totals.",
  "ribbon.offline": "You're offline. We'll keep trying, and nothing you've typed is lost.",
  "ribbon.restricted": "Every view is recorded.",

  /* Access */
  "access.notAllowed": "This part of Haven isn't here, or isn't open to your role. If you need it, ask {name}.",
  "access.notAllowedTitle": "This isn't open to you",
  "access.askFallback": "a super admin",
  "access.viewerToday": "You can look around, but changes are switched off for your role.",

  /* Sign in */
  "auth.welcome": "Welcome back",
  "auth.signIn": "Sign in",
  "auth.signingIn": "Signing you in…",
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.keepSignedIn": "Keep me signed in on this device",
  "auth.forgot": "Forgot your password?",
  "auth.invalid": "That email and password don't match. Please try again.",
  "auth.locked": "Too many tries. For your safety, please wait 15 minutes and try again.",
  "auth.notConfigured": "Sign-in isn't set up on this computer yet.",
  "auth.practiceBadge": "Local test sign-in: two-step verification is skipped",
  "auth.practiceChips": "Practice sign-in",
  "auth.firstAdmin": "Create the first super admin",
  "auth.code": "Sign-in code",
  "auth.codeHint": "Enter the 6-digit code from your authenticator app.",
  "auth.confirmTitle": "Confirm it's you",
  "auth.confirmBody": "For your safety, please sign in again before opening this.",
  "auth.lockedTitle": "Haven is locked",
  "auth.lockedBody": "You've been away for a while, so we locked the screen. Your work underneath is kept.",
  "auth.unlock": "Unlock",
  "auth.forgotSent": "If that email belongs to a Haven team member, we've sent a link. It works for 1 hour.",
  "auth.signOutEverywhere": "Sign out on all devices",

  /* Saving and errors */
  "save.saving": "Saving…",
  "save.saved": "Saved as a draft",
  "save.putLive": "Put these changes live",
  "save.conflict": "Someone else saved changes a moment ago. Reload to see them, then make your change again.",
  "save.reload": "Reload",
  "error.network": "We couldn't save that just now. We'll try again when you're back online. Your text is safe.",
  "error.server": "Something went wrong on our side. Your work is saved.",
  "error.tryAgain": "Try again",
  "error.stale": "Please refresh, we've updated the site.",
  "error.refresh": "Refresh",
  "error.unavailable": "This part of Haven is not switched on yet.",
  "error.forbiddenFields": "Your role can't change these fields: {fields}.",
  "error.blocked": "This can't go live yet.",

  /* Confirmations */
  "confirm.sendTitle": "Send this to {name}?",
  "confirm.sendBody": "They'll get the email below at {email}.",
  "confirm.sendYes": "Send it",
  "confirm.sendNo": "Not yet",
  "confirm.putLive": "Put {count} changes live? Everyone visiting the website will see them straight away.",
  "confirm.roleSafeguarding":
    "Give {name} access to safeguarding concerns? Only do this for trained, vetted staff. We'll record this change.",
  "confirm.keepEditing": "Keep editing",
  "confirm.discard": "Discard changes",
  "confirm.cancel": "Cancel",

  /* Toasts */
  "toast.undo": "Undo",
  "toast.took": "You took {ref}",
  "toast.moved": "Moved to {stage}",
  "toast.movedEmail": "Moved to {stage} · email sent to {name}",
  "toast.movedHeld": "Moved to {stage} · email waiting in the Outbox",
  "toast.copied": "Copied",

  /* Masking */
  "mask.show": "Show",
  "mask.hidden": "Hidden",
  "mask.revealNote": "Showing for 60 seconds. This is recorded.",

  /* Records */
  "record.restricted": "Details are restricted",
  "record.movedToSafeguarding": "Moved to safeguarding",
  "record.caseOnFile": "Case on file",
  "record.lookingAfter": "Looking after this",
  "record.handTo": "Hand to…",
  "record.takeIt": "Take it",
  "record.later": "Later",
  "record.nextStep": "Next:",
  "record.stage": "Stage",
  "record.notes": "Notes",
  "record.addNote": "Add a note",
  "record.closeAway": "Close and put away",
  "record.reopenReason": "Why are you reopening this? (at least 10 characters)",
  "record.guardVerify": "Check and verify the request first, then you can approve it.",
  "record.guardOutcome": "Write a short outcome summary first, then you can mark this complete.",
  "record.guardAssign": "Choose who will look after this first, then you can mark it as Assigned.",
  "record.guardSecondSignOff": "A second safeguarding officer needs to sign off before this can be closed.",
  "record.counsellorNotesHint": "Keep this brief and non-clinical. Clinical notes belong in your professional records, not here.",

  /* Empty states */
  "empty.inbox": "All caught up. Lovely.",
  "empty.requests": "No open requests. When someone asks for help, it will appear in your Inbox first.",
  "empty.giving": "No gifts recorded in {month} yet.",
  "empty.sessions": "No sessions this day. Enjoy the quiet.",
  "empty.posts": "Nothing here yet. An update can be one photo and a few lines.",
  "empty.activity": "Nothing to show for these filters.",
  "empty.search": "Nothing found for “{q}”.",
  "empty.pickFromList": "Pick something from the list.",

  /* Lists */
  "list.loadMore": "Load more",
  "list.loading": "Loading…",
  "list.filters": "Filters",
  "list.clear": "Clear",

  /* Consent and media */
  "consent.block": "We can't put this photo live until a parent or guardian's written consent is recorded.",
  "consent.record": "Record consent",
  "media.illustrative": "Illustrative image",

  /* Connections */
  "integration.stripeOff": "Card payments are off until Stripe is connected. People can still pledge, and you can record gifts here.",
  "integration.emailOff": "Emails wait in the Outbox until email sending is connected.",
  "integration.aiOff": "The writing helper is switched off. You can still write and edit as normal.",
  "integration.zoomOff": "Paste Zoom links by hand. Invitations and reminders still work.",

  /* Glossary (system term → on screen) */
  "term.request": "Request",
  "term.concern": "Concern",
  "term.stage": "Stage",
  "term.acknowledge": "Say thank you",
  "term.allocate": "Put towards…",
  "term.archive": "Close and put away",
  "term.snooze": "Later",
  "term.publish": "Put live",
  "term.unpublish": "Take down",
  "term.draft": "Not live yet",
  "term.export": "Download a spreadsheet",
  "term.roles": "What they can open",
  "term.mfa": "Sign-in code",
  "term.media": "Photos & files",
  "term.integrations": "How Haven is connected",
  "term.audit": "Activity",
  "term.practice": "Practice mode",
} as const;

export type CopyKey = keyof typeof COPY;

/** The string for a key, with {placeholders} filled in. Unknown placeholders are left as written. */
export function t(key: CopyKey, vars?: Record<string, string | number>): string {
  const text: string = COPY[key];
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}
