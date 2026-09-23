import type { SearchBrief, TitlePoolRow } from "./types";

const TMDB_BASE = "https://api.themoviedb.org/3";

function tmdbUrl(path: string, params: Record<string, string | number | undefined>) {
  const url = new URL(TMDB_BASE + path);
  url.searchParams.set("api_key", process.env.TMDB_API_KEY!);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }
  return url.toString();
}

interface GenreMap {
  movie: Map<string, number>;
  tv: Map<string, number>;
}

interface GenreIdToName {
  movie: Map<number, string>;
  tv: Map<number, string>;
}

let genreCache: { map: GenreMap; idToName: GenreIdToName; fetchedAt: number } | null = null;
const GENRE_TTL_MS = 24 * 60 * 60 * 1000;

async function loadGenreCache(): Promise<{ map: GenreMap; idToName: GenreIdToName }> {
  if (genreCache && Date.now() - genreCache.fetchedAt < GENRE_TTL_MS) return genreCache;

  const [movieRes, tvRes] = await Promise.all([
    fetch(tmdbUrl("/genre/movie/list", {})),
    fetch(tmdbUrl("/genre/tv/list", {})),
  ]);
  const [movieJson, tvJson] = await Promise.all([movieRes.json(), tvRes.json()]);

  const genresMovie: { id: number; name: string }[] = movieJson.genres ?? [];
  const genresTv: { id: number; name: string }[] = tvJson.genres ?? [];

  const toMap = (genres: { id: number; name: string }[]) =>
    new Map(genres.map((g) => [g.name.toLowerCase(), g.id]));
  const toIdName = (genres: { id: number; name: string }[]) =>
    new Map(genres.map((g) => [g.id, g.name]));

  const map: GenreMap = { movie: toMap(genresMovie), tv: toMap(genresTv) };
  const idToName: GenreIdToName = { movie: toIdName(genresMovie), tv: toIdName(genresTv) };
  genreCache = { map, idToName, fetchedAt: Date.now() };
  return genreCache;
}

async function getGenreMap(): Promise<GenreMap> {
  return (await loadGenreCache()).map;
}

/** Reverse-lookup genre names for display/prompting (e.g. for feeding the brief model what a partner actually liked). */
export async function getGenreNames(mediaType: "movie" | "tv", ids: number[]): Promise<string[]> {
  const { idToName } = await loadGenreCache();
  const map = idToName[mediaType];
  return ids.map((id) => map.get(id)).filter((n): n is string => Boolean(n));
}

function matchGenreIds(names: string[], map: Map<string, number>): number[] {
  const ids: number[] = [];
  for (const name of names) {
    const lower = name.toLowerCase();
    for (const [genreName, id] of map) {
      if (genreName.includes(lower) || lower.includes(genreName)) {
        ids.push(id);
        break;
      }
    }
  }
  return [...new Set(ids)];
}

interface RawResult {
  id: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path: string | null;
  vote_average: number;
  vote_count: number;
  overview: string;
  original_language: string;
  genre_ids: number[];
}

async function discover(
  mediaType: "movie" | "tv",
  language: string | undefined,
  genreIds: number[],
  yearRange: [number, number],
  minRating: number,
  page: number
): Promise<RawResult[]> {
  const dateField = mediaType === "movie" ? "primary_release_date" : "first_air_date";
  const params: Record<string, string | number | undefined> = {
    // Pipe-separated = OR in TMDB's query language. The brief's genre list is a set of
    // acceptable genres to reconcile both moods, not a combination every title must satisfy —
    // comma-separated (AND) would require a title to match every genre at once and starve the pool.
    with_genres: genreIds.length ? genreIds.join("|") : undefined,
    with_original_language: language,
    "vote_average.gte": minRating,
    "vote_count.gte": 30,
    [`${dateField}.gte`]: `${yearRange[0]}-01-01`,
    [`${dateField}.lte`]: `${yearRange[1]}-12-31`,
    watch_region: "IN",
    sort_by: "popularity.desc",
    page,
  };
  const res = await fetch(tmdbUrl(`/discover/${mediaType}`, params));
  if (!res.ok) return [];
  const json = await res.json();
  return json.results ?? [];
}

async function fetchRuntime(mediaType: "movie" | "tv", id: number): Promise<number | null> {
  try {
    const res = await fetch(tmdbUrl(`/${mediaType}/${id}`, {}));
    if (!res.ok) return null;
    const json = await res.json();
    if (mediaType === "movie") return json.runtime ?? null;
    const episodeRuntimes: number[] = json.episode_run_time ?? [];
    return episodeRuntimes[0] ?? null;
  } catch {
    return null;
  }
}

export async function fetchTitleCandidates(
  brief: SearchBrief,
  excludeTmdbIds: number[] = []
): Promise<Omit<TitlePoolRow, "id" | "session_id" | "round">[]> {
  const genreMap = await getGenreMap();
  const languages =
    brief.languages.length > 0
      ? brief.languages
      : [undefined as unknown as string]; // no language filter

  const mediaTypes: ("movie" | "tv")[] = brief.media_types.length
    ? brief.media_types
    : ["movie", "tv"];
  const excludeSet = new Set(excludeTmdbIds);

  const requests: Promise<{ mediaType: "movie" | "tv"; results: RawResult[] }>[] = [];
  for (const mediaType of mediaTypes) {
    const genreIds = matchGenreIds(brief.genres, genreMap[mediaType]);
    for (const lang of languages) {
      for (const page of [1, 2]) {
        requests.push(
          discover(mediaType, lang, genreIds, brief.year_range, brief.min_rating, page).then(
            (results) => ({ mediaType, results })
          )
        );
      }
    }
  }

  const settled = await Promise.all(requests);

  const merged = new Map<string, { mediaType: "movie" | "tv"; raw: RawResult }>();
  for (const { mediaType, results } of settled) {
    for (const raw of results) {
      const key = `${mediaType}:${raw.id}`;
      if (excludeSet.has(raw.id)) continue;
      if (!merged.has(key)) merged.set(key, { mediaType, raw });
    }
  }

  // Weighted-random sample toward higher-rated titles, capped at 30.
  const pool = [...merged.values()];
  pool.sort((a, b) => b.raw.vote_average - a.raw.vote_average);
  const top = pool.slice(0, 60);
  for (let i = top.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [top[i], top[j]] = [top[j], top[i]];
  }
  const selected = top.slice(0, 30);

  const runtimes = await Promise.all(
    selected.map((entry) => fetchRuntime(entry.mediaType, entry.raw.id))
  );

  return selected.map((entry, idx) => {
    const { mediaType, raw } = entry;
    const dateStr = mediaType === "movie" ? raw.release_date : raw.first_air_date;
    return {
      tmdb_id: raw.id,
      media_type: mediaType,
      title: (mediaType === "movie" ? raw.title : raw.name) ?? "Untitled",
      year: dateStr ? Number(dateStr.slice(0, 4)) : null,
      poster_path: raw.poster_path,
      rating: raw.vote_average,
      runtime: runtimes[idx],
      synopsis: raw.overview,
      raw: raw as unknown as Record<string, unknown>,
    };
  });
}

export async function fetchImdbId(mediaType: "movie" | "tv", tmdbId: number): Promise<string | null> {
  try {
    const res = await fetch(tmdbUrl(`/${mediaType}/${tmdbId}/external_ids`, {}));
    if (!res.ok) return null;
    const json = await res.json();
    return json.imdb_id ?? null;
  } catch {
    return null;
  }
}
