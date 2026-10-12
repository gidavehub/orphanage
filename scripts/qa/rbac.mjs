// Role-based access check for the admin (PLAN §5.5, §6.2 A gate). For each seeded practice role it
// signs in through POST /api/dev/session (practice mode only), then checks:
//   - /admin answers 200 with the desk shell (Today);
//   - /admin/safeguarding is refused for everyone except safeguarding officers and super admins
//     (until A3 builds the page, every role gets "not found", which also counts as refused);
//   - the server-side "rbac" selftest suite passes for that session (requireStaff, the permission
//     matrix, places and the DAL's record checks).
// It also checks that a signed-out request to /admin redirects to /admin/login?next=%2Fadmin.
// With --phase a (after Phase A) every place URL is checked against the access matrix as well.
//
//   node scripts/qa/rbac.mjs                                  http://localhost:3001
//   node scripts/qa/rbac.mjs --base http://localhost:3100     the lead's production build
//   node scripts/qa/rbac.mjs --phase a                        also every place, for every role
//   node scripts/qa/rbac.mjs --role finance_officer           one role only
//
// Prints one line per check and a summary; exits 1 when anything fails. Never prints cookies.

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};
const BASE = String(flag("--base", "http://localhost:3001")).replace(/\/+$/, "");
const PHASE_A = flag("--phase", "") === "a";
const ONLY = flag("--role", null);

const ROLES = ["super_admin", "content_manager", "programme_officer", "safeguarding_officer", "finance_officer", "counsellor", "report_manager", "viewer"];
const SAFEGUARDING = new Set(["super_admin", "safeguarding_officer"]);

// The access matrix (admin-ux §5.1 through lib/admin/access.ts AREA_PERMS and data-model §6.1), for
// the seeded accounts (the practice viewer holds the support, donations, engagement and content scopes).
const PLACES = {
  inbox: "/admin/inbox",
  requests: "/admin/requests",
  safeguarding: "/admin/safeguarding",
  giving: "/admin/giving",
  counselling: "/admin/counselling",
  library: "/admin/library",
  people: "/admin/people",
  website: "/admin/website/home",
  posts: "/admin/posts",
  media: "/admin/media",
  team: "/admin/team",
  activity: "/admin/activity",
  settings: "/admin/settings",
};
const ALLOWED = {
  super_admin: Object.keys(PLACES),
  content_manager: ["inbox", "giving", "library", "website", "posts", "media", "activity", "settings"],
  programme_officer: ["inbox", "requests", "giving", "counselling", "people", "website", "posts", "activity", "settings"],
  safeguarding_officer: ["inbox", "safeguarding", "website", "media", "activity", "settings"],
  finance_officer: ["inbox", "giving", "website", "activity", "settings"],
  counsellor: ["counselling"],
  report_manager: ["inbox", "library", "website", "activity", "settings"],
  viewer: ["requests", "giving", "library", "people", "website", "activity"],
};

const NO_ACCESS = 'id="no-access-title"';
const NOT_FOUND_PUBLIC = 'id="not-found-title"';

let failures = 0;
let passes = 0;
function report(ok, label, detail = "") {
  if (ok) passes++;
  else failures++;
  console.log(`${ok ? "  ✓" : "  ✗"} ${label}${detail ? `  (${detail})` : ""}`);
}

/** Signs in as a practice role and returns the Cookie header (never printed). */
async function signIn(role) {
  const res = await fetch(`${BASE}/api/dev/session?role=${encodeURIComponent(role)}`, { method: "POST", redirect: "manual" });
  if (res.status === 404) throw new Error("practice sign-in is not available (the server must be in local practice mode)");
  if (!res.ok) throw new Error(`sign-in as ${role} answered ${res.status}`);
  const cookies = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [res.headers.get("set-cookie") ?? ""];
  const pairs = cookies.map((c) => c.split(";")[0]).filter((c) => /^(__Host-)?haven_session=/.test(c));
  if (!pairs.length) throw new Error(`sign-in as ${role} set no session cookie`);
  return pairs.join("; ");
}

async function get(path, cookie) {
  const res = await fetch(`${BASE}${path}`, { headers: cookie ? { cookie } : {}, redirect: "manual" });
  const body = res.status === 200 || res.status === 404 ? await res.text() : "";
  return { status: res.status, location: res.headers.get("location") ?? "", body };
}

// A refusal thrown inside a Suspense boundary after the shell has streamed: production sends the
// 404 digest and the NoAccess tree in the RSC payload, and the browser shows it on hydration.
const STREAMED_404 = 'data-dgst="NEXT_HTTP_ERROR_FALLBACK;404"';
const NO_ACCESS_RSC = '\\"id\\":\\"no-access-title\\"';

/** Refused = the friendly NoAccess page inside the shell, or a 404 (no such page yet). */
function refused(r) {
  return r.status === 404 || r.body.includes(NO_ACCESS) || r.body.includes(NOT_FOUND_PUBLIC) || (r.body.includes(STREAMED_404) && r.body.includes(NO_ACCESS_RSC));
}

async function checkRole(role) {
  console.log(`\n${role}`);
  let cookie;
  try {
    cookie = await signIn(role);
    report(true, "practice sign-in");
  } catch (err) {
    report(false, "practice sign-in", err.message);
    return;
  }

  const today = await get("/admin", cookie);
  report(today.status === 200 && today.body.includes('id="main"') && !refused(today), "/admin → 200 with the desk shell", `status ${today.status}`);

  const sg = await get("/admin/safeguarding", cookie);
  if (SAFEGUARDING.has(role) && PHASE_A) {
    const stepUp = sg.status === 307 && sg.location.includes("/admin/confirm");
    report((sg.status === 200 && !refused(sg)) || stepUp, "/admin/safeguarding opens (or asks to confirm it's you)", `status ${sg.status}`);
  } else if (!SAFEGUARDING.has(role)) {
    report(refused(sg), "/admin/safeguarding is refused", `status ${sg.status}`);
  } else {
    report(sg.status === 200 || sg.status === 404 || sg.status === 307, "/admin/safeguarding answers (page arrives with A3)", `status ${sg.status}`);
  }

  const suite = await fetch(`${BASE}/api/dev/selftest?suite=rbac`, { headers: { cookie, accept: "application/json" } });
  let body = null;
  try {
    body = await suite.json();
  } catch {
    // not JSON
  }
  if (!body || !Array.isArray(body.cases)) {
    report(false, "rbac selftest suite", `answered ${suite.status}`);
  } else {
    const failed = body.cases.filter((c) => !c.ok);
    report(failed.length === 0, `rbac selftest suite: ${body.passed} passed, ${body.failed} failed`, failed.map((c) => `${c.name}: ${c.detail ?? ""}`).join(" | "));
  }

  if (PHASE_A) {
    for (const [area, path] of Object.entries(PLACES)) {
      if (area === "safeguarding") continue;
      const r = await get(path, cookie);
      const should = ALLOWED[role].includes(area);
      const ok = should ? r.status === 200 && !refused(r) : refused(r);
      report(ok, `${path} ${should ? "opens" : "is refused"}`, `status ${r.status}`);
    }
  }
}

async function main() {
  console.log(`Haven RBAC check against ${BASE}${PHASE_A ? " (phase A: every place)" : ""}`);
  let anon;
  try {
    anon = await get("/admin");
  } catch (err) {
    console.error(`Could not reach ${BASE}: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
  report(anon.status === 307 && anon.location.includes("/admin/login?next=%2Fadmin"), "signed out: /admin → /admin/login?next=%2Fadmin", `status ${anon.status}`);

  for (const role of ONLY ? [ONLY] : ROLES) await checkRole(role);

  console.log(`\nrbac: ${passes} passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
