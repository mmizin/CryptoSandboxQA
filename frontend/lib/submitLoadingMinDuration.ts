/**
 * Keeps submit loading UI visible long enough to perceive (fast local APIs otherwise flash).
 * Waits only if the request finished sooner than this minimum.
 */
export const SUBMIT_LOADING_MIN_MS = 3500;

export async function awaitMinElapsedSince(
  startedAt: number,
  minMs = SUBMIT_LOADING_MIN_MS
): Promise<void> {
  const remaining = minMs - (Date.now() - startedAt);
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
}
