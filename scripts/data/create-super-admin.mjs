// Create Haven's first super admin in Firebase (PLAN D88; data-model §9.1). Everyone else is invited
// from Team in the admin.
//
//   node scripts/data/create-super-admin.mjs --project orphanage-project-511119 --email you@haven.org --name "Your Name"
//
// Credentials: FIREBASE_SERVICE_ACCOUNT_JSON (environment or .env.local) or Application Default
// Credentials. It creates (or reuses) the Firebase Auth user, writes staff/{uid} with the super admin
// role, and prints a one-time password-setup link for that person. Run it once; it refuses to add a
// second super admin when one already exists (unless --force). Sign-in codes (TOTP) are required for
// super admins: they set one up at their first sign-in.

import { readFile } from "node:fs/promises";

const args = process.argv.slice(2);
const flag = (f) => (args.includes(f) ? args[args.indexOf(f) + 1] : null);
const PROJECT = flag("--project");
const EMAIL = flag("--email")?.trim();
const NAME = flag("--name")?.trim();

if (!PROJECT || !EMAIL || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(EMAIL) || !NAME || NAME.length < 2) {
  console.error('Usage: node scripts/data/create-super-admin.mjs --project <id> --email <address> --name "<full name>"');
  process.exit(1);
}

const text = await readFile(".env.local", "utf8").catch(() => "");
const local = Object.fromEntries(text.split(/\r?\n/).map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^"|"$/g, "")]));
const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? local.FIREBASE_SERVICE_ACCOUNT_JSON;

const { initializeApp, cert, applicationDefault } = await import("firebase-admin/app");
const { getAuth } = await import("firebase-admin/auth");
const { getFirestore, Timestamp } = await import("firebase-admin/firestore");
const app = initializeApp({ credential: saJson ? cert(JSON.parse(saJson)) : applicationDefault(), projectId: PROJECT });
const auth = getAuth(app);
const db = getFirestore(app);

const admins = await db.collection("staff").where("roles", "array-contains", "super_admin").where("status", "==", "active").limit(1).get();
if (!admins.empty && !args.includes("--force")) {
  console.error("A super admin already exists. Invite people from Team instead (or pass --force).");
  process.exit(1);
}

let user;
try {
  user = await auth.getUserByEmail(EMAIL);
  console.log("Using the existing Firebase user for that address.");
} catch {
  // Verified: the password link goes to this address, and sign-in codes (TOTP) need a verified email.
  user = await auth.createUser({ email: EMAIL, displayName: NAME, emailVerified: true, disabled: false });
  console.log("Created the Firebase user.");
}

const now = Timestamp.now();
await db.doc(`staff/${user.uid}`).set({
  uid: user.uid,
  email: EMAIL,
  emailLower: EMAIL.toLowerCase(),
  displayName: NAME,
  roles: ["super_admin"],
  viewerScopes: [],
  programmeScope: "all",
  status: "active",
  mfa: { required: true, enrolled: false, enrolledAt: null },
  counsellor: null,
  notificationPrefs: { email: { inbox: "instant", handoffs: "instant", sessions: "instant", drafts: "daily_digest" }, inApp: true },
  timezone: "Africa/Banjul",
  textSize: "normal",
  tourDoneAt: null,
  zoomPersonalLink: null,
  avatarMediaId: null,
  lastSignInAt: null,
  sessionsRevokedAt: null,
  invitedBy: null,
  authProvider: "password",
  createdAt: now,
  updatedAt: now,
  version: 1,
});
await db.collection("auditLog").add({
  at: now,
  actor: { kind: "system", job: "create-super-admin" },
  action: "staff.invite",
  area: "staff",
  feed: true,
  sensitive: true,
  targetPath: `staff/${user.uid}`,
  targetRef: null,
  summary: `The first super admin (${NAME}) was set up from the command line`,
  changes: null,
  ipHash: null,
  device: null,
  requestId: "cli",
});

const link = await auth.generatePasswordResetLink(EMAIL);
console.log(`\n${NAME} is now a super admin.\nSend them this one-time link to choose a password (it expires in about an hour):\n\n${link}\n`);
console.log("They sign in at /admin/login and set up a sign-in code on their phone at the first sign-in.");
