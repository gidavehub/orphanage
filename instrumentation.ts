// Runs once when a server instance starts (Next.js instrumentation). Logs the boot report: what is
// connected and the names of production variables still missing (integrations §8.2, PLAN D110).

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { bootReport } = await import("@/lib/server/boot");
  bootReport();
}
