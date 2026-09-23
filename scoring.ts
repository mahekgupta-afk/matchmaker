import type { TitlePoolRow } from "./types";

interface SwipeLike {
  round: number;
  partner: "a" | "b";
  tmdb_id: number;
  direction: "like" | "pass";
}

/** Combined score across all rounds: 2 if both partners liked it, 1 if exactly one did. */
export function computeCombinedScores(swipes: SwipeLike[]): Map<number, number> {
  const likesByTitle = new Map<number, Set<"a" | "b">>();
  for (const swipe of swipes) {
    if (swipe.direction !== "like") continue;
    const set = likesByTitle.get(swipe.tmdb_id) ?? new Set();
    set.add(swipe.partner);
    likesByTitle.set(swipe.tmdb_id, set);
  }
  const scores = new Map<number, number>();
  for (const [tmdbId, partners] of likesByTitle) {
    scores.set(tmdbId, partners.size);
  }
  return scores;
}

export function topFiveByScore(
  pool: TitlePoolRow[],
  swipes: SwipeLike[]
): TitlePoolRow[] {
  const scores = computeCombinedScores(swipes);
  const byId = new Map(pool.map((t) => [t.tmdb_id, t]));
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tmdbId]) => byId.get(tmdbId))
    .filter((t): t is TitlePoolRow => Boolean(t));
}
