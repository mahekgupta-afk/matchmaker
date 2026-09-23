import { getSupabaseServerClient } from "./supabase";
import { generateRoundOneBrief, generateRoundTwoBrief } from "./gemini";
import { fetchTitleCandidates, getGenreNames } from "./tmdb";
import type { Preferences, SearchBrief, TitlePoolRow } from "./types";

async function summarizePairHistory(pairId: string | null): Promise<string | undefined> {
  if (!pairId) return undefined;
  const supabase = getSupabaseServerClient();

  const { data: sessions } = await supabase.from("sessions").select("id").eq("pair_id", pairId);
  const sessionIds = (sessions ?? []).map((s) => s.id);
  if (sessionIds.length === 0) return undefined;

  const [{ data: matches }, { data: ratings }] = await Promise.all([
    supabase.from("matches").select("session_id, tmdb_id").in("session_id", sessionIds),
    supabase.from("ratings").select("tmdb_id, rating").in("session_id", sessionIds),
  ]);

  if (!matches?.length) return undefined;

  const ratingByTitle = new Map((ratings ?? []).map((r) => [r.tmdb_id, r.rating]));
  const parts = matches.map((m) => {
    const rating = ratingByTitle.get(m.tmdb_id);
    return rating ? `tmdb:${m.tmdb_id} (rated ${rating}/5)` : `tmdb:${m.tmdb_id} (unrated)`;
  });
  return `Previously matched on ${parts.join(", ")}.`;
}

export async function startRoundOne(sessionId: string, pairId: string | null): Promise<void> {
  const supabase = getSupabaseServerClient();

  const { data: prefRows } = await supabase
    .from("preferences")
    .select("*")
    .eq("session_id", sessionId);

  const prefsA = prefRows?.find((p) => p.partner === "a");
  const prefsB = prefRows?.find((p) => p.partner === "b");
  if (!prefsA || !prefsB) return;

  const toPrefs = (row: typeof prefsA): Preferences => ({
    mood: row.mood,
    moodFreetext: row.mood_freetext ?? "",
    languages: row.languages,
    contentType: row.content_type,
    minRating: row.min_rating,
    eras: row.eras,
  });

  await supabase.from("sessions").update({ status: "generating_brief" }).eq("id", sessionId);

  const historySummary = await summarizePairHistory(pairId);
  const brief = await generateRoundOneBrief(toPrefs(prefsA), toPrefs(prefsB), historySummary);

  await insertRound(sessionId, 1, brief, []);
}

export async function startRoundTwo(sessionId: string): Promise<void> {
  const supabase = getSupabaseServerClient();

  const { data: briefRows } = await supabase
    .from("briefs")
    .select("*")
    .eq("session_id", sessionId)
    .eq("round", 1)
    .single();
  const originalBrief = briefRows?.brief as SearchBrief;

  const { data: pool } = await supabase
    .from("title_pool")
    .select("*")
    .eq("session_id", sessionId)
    .eq("round", 1);
  const { data: swipes } = await supabase
    .from("swipes")
    .select("*")
    .eq("session_id", sessionId)
    .eq("round", 1)
    .eq("direction", "like");

  const poolById = new Map((pool ?? []).map((t: TitlePoolRow) => [t.tmdb_id, t]));
  const likedFor = async (partner: "a" | "b") => {
    const titles = (swipes ?? [])
      .filter((s) => s.partner === partner)
      .map((s) => poolById.get(s.tmdb_id))
      .filter((t): t is TitlePoolRow => Boolean(t));
    return Promise.all(
      titles.map(async (t) => ({
        title: t.title,
        genres: await getGenreNames(t.media_type, (t.raw as { genre_ids?: number[] })?.genre_ids ?? []),
      }))
    );
  };

  const [likedA, likedB] = await Promise.all([likedFor("a"), likedFor("b")]);
  const brief = await generateRoundTwoBrief(originalBrief, likedA, likedB);
  const excludeIds = (pool ?? []).map((t: TitlePoolRow) => t.tmdb_id);

  await insertRound(sessionId, 2, brief, excludeIds);
}

async function insertRound(
  sessionId: string,
  round: number,
  brief: SearchBrief,
  excludeIds: number[]
): Promise<void> {
  const supabase = getSupabaseServerClient();

  await supabase.from("briefs").insert({ session_id: sessionId, round, brief });

  const candidates = await fetchTitleCandidates(brief, excludeIds);
  await supabase.from("title_pool").insert(
    candidates.map((c) => ({ ...c, session_id: sessionId, round }))
  );

  await supabase
    .from("sessions")
    .update({ status: "swiping", round, updated_at: new Date().toISOString() })
    .eq("id", sessionId);
}
