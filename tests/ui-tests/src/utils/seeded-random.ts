/**
 * Mulberry32 PRNG — deterministic when given the same seed (for CI via `PLAYWRIGHT_RANDOM_SEED`).
 */
export function createMulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Base seed: `PLAYWRIGHT_RANDOM_SEED` / `TEST_RANDOM_SEED` (integer), or random if unset.
 * Combine with a per-test salt so parallel tests don't all pick the same pair.
 */
export function getSeedFromEnv(): number {
    const raw = process.env.PLAYWRIGHT_RANDOM_SEED ?? process.env.TEST_RANDOM_SEED;
    if (raw !== undefined && raw !== "") {
        const parsed = Number.parseInt(raw, 10);
        if (!Number.isNaN(parsed)) {
            return parsed >>> 0;
        }
    }
    return Math.floor(Math.random() * 0x7fffffff);
}

/** Mix base seed with a stable string (e.g. test title) so each test picks a different drag pair. */
export function combineSeed(baseSeed: number, salt: string): number {
    let h = baseSeed >>> 0;
    for (let i = 0; i < salt.length; i++) {
        h = (Math.imul(31, h) + salt.charCodeAt(i)) | 0;
    }
    return h >>> 0;
}

export function pickDistinctIndices(rng: () => number, length: number): { from: number; to: number } {
    if (length < 2) {
        throw new Error("pickDistinctIndices: need at least 2 items");
    }
    let from = Math.floor(rng() * length);
    let to = Math.floor(rng() * length);
    let guard = 0;
    while (from === to && guard++ < 64) {
        to = Math.floor(rng() * length);
    }
    if (from === to) {
        to = (from + 1) % length;
    }
    return { from, to };
}
