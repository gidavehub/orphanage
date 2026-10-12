// Shared by the browser checks: `--cookie "name=value"` adds a session cookie, `--role <role>` signs
// in as a practice role first (practice mode only). Both apply to a Playwright browser context.

export function sessionFlags(args) {
  const flag = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : null);
  return { cookie: flag("--cookie"), role: flag("--role") };
}

export async function applySession(ctx, base, { cookie, role }) {
  if (role) {
    const r = await ctx.request.post(`${base}/api/dev/session?role=${encodeURIComponent(role)}`);
    if (!r.ok()) throw new Error(`Practice sign-in as ${role} failed (${r.status()}).`);
  }
  if (cookie) {
    const [name, ...rest] = cookie.split("=");
    await ctx.addCookies([{ name: name.trim(), value: rest.join("=").trim(), url: base }]);
  }
}
