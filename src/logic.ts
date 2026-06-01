// Pure, deterministic helpers — no React, no Yjs — so they can be unit-tested
// in isolation AND so every phone derives an identical rope position from the
// same per-peer tap counts. Nothing here writes shared state: the rope is a
// *derived* value, never a contended counter.

export type Team = "L" | "R" | "";

/**
 * Where the rope marker sits, derived purely from each team's cumulative taps.
 *
 * Positive → the marker is dragged toward the RIGHT (🔵) team; negative → toward
 * the LEFT (🔴) team; 0 → dead centre. The raw `(rightTaps - leftTaps) * k`
 * offset is clamped to `[-max, +max]` so the marker can never leave the track,
 * and so a blowout still reads as "fully pulled over" rather than off-screen.
 */
export function ropePosition(leftTaps: number, rightTaps: number, k: number, max: number): number {
  const raw = (rightTaps - leftTaps) * k;
  return Math.max(-max, Math.min(max, raw));
}

/**
 * Resolve a rope position into a winner, or `null` while the marker is still
 * short of either threshold. A team wins only once the marker is dragged all
 * the way to (or past) its side — i.e. the clamped extreme. `+max` → right
 * team, `-max` → left team.
 */
export function winnerOf(position: number, max: number): Team | null {
  if (max <= 0) return null;
  if (position >= max) return "R";
  if (position <= -max) return "L";
  return null;
}

/**
 * Sum every peer's cumulative taps into a per-team total, given a `teamOf`
 * lookup. Peers with no team (or an unknown team) are ignored, so an
 * unassigned spectator tapping cannot move the rope. Pure over the raw
 * `usePerPeerValue.entries` array so it survives CRDT merge order.
 */
export function teamTotals(
  entries: Array<[string, number]>,
  teamOf: (peerId: string) => Team,
): { left: number; right: number } {
  let left = 0;
  let right = 0;
  for (const [peerId, taps] of entries) {
    if (typeof taps !== "number" || !Number.isFinite(taps) || taps <= 0) continue;
    const team = teamOf(peerId);
    if (team === "L") left += taps;
    else if (team === "R") right += taps;
  }
  return { left, right };
}

/**
 * Map a clamped rope position to a 0..100 percentage for CSS `left:`/`transform:`
 * placement. `-max` → 0% (hard left), `0` → 50% (centre), `+max` → 100%.
 */
export function ropePercent(position: number, max: number): number {
  if (max <= 0) return 50;
  const clamped = Math.max(-max, Math.min(max, position));
  return ((clamped + max) / (2 * max)) * 100;
}
