/**
 * Optional pause before writing orders/deposits to the DB (training/sandbox).
 * Mimics payment rails or settlement sync latency. Set SIMULATED_PERSIST_DELAY_MS=0 to disable.
 */
const DEFAULT_MS = 1_200;
const MAX_MS = 60_000;

function delayMsFromEnv(): number {
  const raw = process.env.SIMULATED_PERSIST_DELAY_MS;
  if (raw === undefined || raw === '') return DEFAULT_MS;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_MS;
  return Math.min(n, MAX_MS);
}

export async function simulatedPersistDelay(): Promise<void> {
  const ms = delayMsFromEnv();
  if (ms <= 0) return;
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}
