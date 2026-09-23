import type { StreamingOption } from "./types";

/** Friendly display names for the raw platform codes this API returns. Falls back to a capitalized code. */
const PLATFORM_NAMES: Record<string, string> = {
  netflix: "Netflix",
  amazon: "Amazon Prime Video",
  primevideo: "Amazon Prime Video",
  hotstar: "Disney+ Hotstar",
  jiocinema: "JioCinema",
  zee5: "ZEE5",
  sonyliv: "SonyLIV",
  voot: "Voot",
  viu: "Viu",
  erosnow: "Eros Now",
  hoichoi: "Hoichoi",
  altbalaji: "ALTBalaji",
  hungama: "Hungama Play",
  sunnxt: "Sun NXT",
  yupptv: "Yupp TV",
  mubi: "MUBI",
  itunes: "Apple iTunes",
  appletv: "Apple TV+",
  play: "Google Play Movies",
  youtube: "YouTube",
  tubitv: "Tubi TV",
  crunchyroll: "Crunchyroll",
  bookmyshow: "BookMyShow",
};

function displayName(platform: string): string {
  return PLATFORM_NAMES[platform.toLowerCase()] ?? platform.charAt(0).toUpperCase() + platform.slice(1);
}

interface OttTitleDetails {
  imdbid?: string;
  imdbrating?: number;
  streamingAvailability?: {
    country?: Record<string, { platform?: string; url?: string }[] | undefined>;
  };
}

interface OttResult {
  imdbRating: number | null;
  streaming: StreamingOption[];
}

/** Fetch India streaming availability + IMDb rating for a title, keyed by IMDb id (e.g. "tt1234567"). */
export async function fetchIndianStreamingOptions(imdbId: string): Promise<OttResult> {
  const host = process.env.RAPIDAPI_HOST!;
  const res = await fetch(`https://${host}/gettitleDetails?imdbid=${imdbId}`, {
    headers: {
      "Content-Type": "application/json",
      "x-rapidapi-host": host,
      "x-rapidapi-key": process.env.RAPIDAPI_KEY!,
    },
  });
  if (!res.ok) return { imdbRating: null, streaming: [] };

  const json: OttTitleDetails = await res.json();
  const country = json.streamingAvailability?.country ?? {};
  const raw = country["IN"] ?? country["in"] ?? [];

  const seen = new Set<string>();
  const options: StreamingOption[] = [];
  for (const opt of raw) {
    if (!opt.platform || !opt.url || seen.has(opt.platform)) continue;
    seen.add(opt.platform);
    options.push({
      service: displayName(opt.platform),
      logo: "",
      link: opt.url,
      type: "subscription",
    });
  }

  return { imdbRating: typeof json.imdbrating === "number" ? json.imdbrating : null, streaming: options };
}
