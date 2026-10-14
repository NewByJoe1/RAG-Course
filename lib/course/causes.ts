export type CauseOption = { id: string; text: string };

/** FNV-1a: a small, stable string hash. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Display order for a case's cause options: shuffled (so the correct one isn't
 * always first, as authored) but stable per case, so it's the same on every
 * visit and in both the gallery and review cards.
 */
export function orderCauseOptions(caseId: string, options: CauseOption[]): CauseOption[] {
  let seed = hash(caseId) || 1;
  const rand = () => {
    // xorshift32
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 0x100000000;
  };
  const out = [...options];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
