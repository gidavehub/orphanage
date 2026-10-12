// Help guides for the Haven team space (admin-ux §6.18; ToR §16 orientation). Short, plain steps,
// filtered by role and listed first-day first. Screenshots are added later (CLIENT). Every guide
// names the place it lives in, so a guide can link straight to it.

import type { Role } from "../lib/model/permissions";

export type HelpGuide = {
  slug: string;
  title: string;
  /** One sentence under the title on the card. */
  summary: string;
  /** Who sees it; empty means everyone. */
  roles: Role[];
  /** Where the work happens. */
  place?: { label: string; href: string };
  art: "hands" | "hearts" | "doodle" | "plane" | "sprig" | "house" | "heart";
  steps: Array<{ title: string; body: string }>;
  /** A gentle closing tip. */
  tip?: string;
};

export const HELP_GUIDES: HelpGuide[] = [
  {
    slug: "first-day",
    title: "Your first day",
    summary: "Where things are, and the three habits that keep everyone safe.",
    roles: [],
    place: { label: "Today", href: "/admin" },
    art: "hands",
    steps: [
      { title: "Start on Today", body: "Today shows what needs you, what's coming up and how Haven is doing this month. Come back to it whenever you feel lost." },
      { title: "Use ＋ New for anything new", body: "A phone call, a gift handed in at the office, an update for the website: ＋ New starts it from any page." },
      { title: "Find anything", body: "Press Ctrl K (⌘ K on a Mac), or tap Find on your phone, and type a name, an email, a phone number or a reference." },
      { title: "Write it down", body: "Every call, visit and decision belongs in a note on the record. If it isn't written down, the next person can't help." },
      { title: "Protect privacy", body: "Never copy a child's details into email, WhatsApp or a personal phone. Phone numbers and emails stay hidden until you press Show, and every Show is logged." },
    ],
    tip: "Not sure? Ask your super admin. Nothing you do here is ever lost: every change is kept in the history.",
  },
  {
    slug: "new-request",
    title: "Taking a new request",
    summary: "From the Inbox to a first reply, in five steps.",
    roles: ["super_admin", "programme_officer"],
    place: { label: "Inbox", href: "/admin/inbox" },
    art: "plane",
    steps: [
      { title: "Take it", body: "In the Inbox, press Take it (or swipe right on your phone). The request becomes yours and moves to Under review." },
      { title: "Read it carefully", body: "Check the type of support, the urgency and whether it is safe to contact the person, and how." },
      { title: "Make first contact", body: "Call or message the person the way they asked. If they said it isn't always safe, follow their best-time notes." },
      { title: "Note what you agreed", body: "Add a note: who you spoke to, what they need and what happens next. Set a follow-up date if you're waiting on something." },
      { title: "Move it on", body: "Use the stage steps at the top: Assigned, Referred, Approved and so on. The person gets an email only where the stage says so." },
    ],
    tip: "If anything suggests a child is in danger, stop and use 'This is a child-protection concern'. It goes straight to Safeguarding.",
  },
  {
    slug: "good-note",
    title: "Writing a good note",
    summary: "Short, factual and useful to the next person.",
    roles: ["super_admin", "programme_officer", "safeguarding_officer", "counsellor", "finance_officer"],
    art: "doodle",
    steps: [
      { title: "Facts first", body: "What happened, when, and who was there. Use the person's words in quotes when it matters." },
      { title: "Keep opinions apart", body: "If you add your view, say so: 'My impression is…'." },
      { title: "Say what happens next", body: "Who does what, by when. Set a follow-up if you need a reminder." },
      { title: "Leave out what isn't needed", body: "No children's surnames, school names or exact addresses unless the case truly needs them." },
    ],
  },
  {
    slug: "safeguarding-concern",
    title: "When a safeguarding concern arrives",
    summary: "What the safeguarding team does in the first hour.",
    roles: ["super_admin", "safeguarding_officer"],
    place: { label: "Safeguarding", href: "/admin/safeguarding" },
    art: "heart",
    steps: [
      { title: "Acknowledge it", body: "Open the concern and acknowledge it. This stops the repeat alert emails to the team." },
      { title: "Is a child in danger now?", body: "If yes, contact the emergency, police or child-protection authority first. Then log what you did." },
      { title: "Assess the risk", body: "Choose the risk level and write why. 'Not yet assessed' is allowed while you gather facts." },
      { title: "Record every action", body: "Calls, referrals and visits go in the actions log, with the time. Authority referrals have their own sheet." },
      { title: "Closing", body: "A high or immediate risk concern needs a second safeguarding officer to agree before it closes." },
    ],
    tip: "Concern details never leave Safeguarding. Don't copy them into other records, messages or email.",
  },
  {
    slug: "cash-gift",
    title: "Recording a gift that came in cash",
    summary: "A gift handed in at the office, or paid by Wave or bank transfer.",
    roles: ["super_admin", "finance_officer"],
    place: { label: "Giving", href: "/admin/giving" },
    art: "hearts",
    steps: [
      { title: "＋ New → Record a gift", body: "Choose cash, the currency and the amount. Add the donor's name and how to reach them for the thank-you." },
      { title: "Choose where it goes", body: "Pick the cause the donor chose. You can split it later in Allocate." },
      { title: "Mark it received", body: "When the money is counted or shows in the account, mark the gift as received." },
      { title: "Say thank you", body: "Acknowledge the gift. Haven issues the next receipt number and emails the receipt." },
    ],
  },
  {
    slug: "book-session",
    title: "Booking a session and adding Zoom",
    summary: "From a counselling request to a confirmed session.",
    roles: ["super_admin", "programme_officer", "counsellor"],
    place: { label: "Counselling", href: "/admin/counselling" },
    art: "sprig",
    steps: [
      { title: "Find a time", body: "Requests waiting for a time are listed first. Check the client's preferred days and their timezone." },
      { title: "Book it", body: "＋ New → Book a session. Times are shown in your timezone, with the client's time beside them." },
      { title: "Paste the Zoom link", body: "Create the meeting in Zoom and paste the join link. Haven checks that it is a real Zoom link." },
      { title: "Send the invitation", body: "The client gets the confirmation with a calendar file. Reminders go 24 hours and 1 hour before." },
    ],
  },
  {
    slug: "post-update",
    title: "Posting an update from your phone",
    summary: "A photo and a few lines, straight from a visit.",
    roles: ["super_admin", "content_manager", "programme_officer"],
    place: { label: "Posts", href: "/admin/posts" },
    art: "plane",
    steps: [
      { title: "＋ New → Post an update", body: "Write two or three short sentences about what happened today." },
      { title: "Add a photo", body: "Only photos you have consent for. Never a child's face without written permission." },
      { title: "Send for review", body: "A reviewer reads it, ticks the checklist and puts it live." },
    ],
  },
  {
    slug: "monthly-draft",
    title: "Reviewing the monthly draft",
    summary: "The AI writes a first draft each month; a person always decides.",
    roles: ["super_admin", "content_manager"],
    place: { label: "Posts › Review", href: "/admin/posts/review" },
    art: "doodle",
    steps: [
      { title: "Open the draft", body: "It waits in Review with its sources shown beside it." },
      { title: "Check every fact", body: "Numbers, places and names must match the sources. Remove anything you can't confirm." },
      { title: "Protect privacy", body: "No child's name, school or exact place. The safety check highlights anything that looks risky." },
      { title: "Tick the checklist and approve", body: "Or send it back with a note. Nothing goes live without a person's approval." },
    ],
  },
  {
    slug: "edit-website",
    title: "Editing the website",
    summary: "Change words and photos on the page itself, then put them live.",
    roles: ["super_admin", "content_manager"],
    place: { label: "Website", href: "/admin/website" },
    art: "house",
    steps: [
      { title: "Open the page", body: "In Website, choose the page. You'll see it exactly as visitors do." },
      { title: "Tap what you want to change", body: "A side sheet opens with that part's words and pictures. Changes save as a draft." },
      { title: "Check it", body: "Switch to phone view to see how it looks on a small screen." },
      { title: "Put changes live", body: "Review the list of changes and press Put changes live. You can undo from the history." },
    ],
  },
  {
    slug: "phone-number",
    title: "Changing the phone number",
    summary: "Update the phone, email or office address everywhere at once.",
    roles: ["super_admin", "content_manager"],
    place: { label: "Key information", href: "/admin/website/key-info" },
    art: "heart",
    steps: [
      { title: "Open Key information", body: "Website → Key information holds the phone, email, offices, social links and emergency numbers." },
      { title: "Change and publish", body: "Edit the field and press Publish. It updates the header, footer, contact page and emails." },
      { title: "Undo if needed", body: "For 10 seconds after publishing you can press Undo. After that, use the history." },
    ],
  },
];

/** The guides a person with these roles sees, first-day first. */
export function guidesFor(roles: readonly Role[]): HelpGuide[] {
  return HELP_GUIDES.filter((g) => !g.roles.length || g.roles.some((r) => roles.includes(r)));
}

export function guideBySlug(slug: string): HelpGuide | undefined {
  return HELP_GUIDES.find((g) => g.slug === slug);
}
