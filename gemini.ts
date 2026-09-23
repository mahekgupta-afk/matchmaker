import { BriefSchema, LANGUAGE_ISO, type Preferences, type SearchBrief } from "./types";

const GEMINI_MODEL = "gemini-flash-latest";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const BRIEF_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    genres: {
      type: "ARRAY",
      items: { type: "STRING" },
      description: "TMDB-style genre names, e.g. Comedy, Thriller, Romance",
    },
    keywords: {
      type: "ARRAY",
      items: { type: "STRING" },
      description: "Thematic/tonal keywords capturing the mood nuance",
    },
    exclude: {
      type: "ARRAY",
      items: { type: "STRING" },
      description: "Genres/themes to actively avoid",
    },
    languages: {
      type: "ARRAY",
      items: { type: "STRING" },
      description: "ISO 639-1 codes, e.g. hi, en, ta",
    },
    media_types: {
      type: "ARRAY",
      items: { type: "STRING", enum: ["movie", "tv"] },
    },
    year_range: {
      type: "ARRAY",
      items: { type: "NUMBER" },
      description: "Exactly two numbers: [startYear, endYear]",
    },
    min_rating: { type: "NUMBER" },
    mood_summary: {
      type: "STRING",
      description: "One sentence capturing the combined vibe both partners are after tonight",
    },
  },
  required: ["genres", "keywords", "languages", "media_types", "year_range", "min_rating", "mood_summary"],
};

function eraToYearRange(eras: string[]): [number, number] {
  if (eras.includes("Any") || eras.length === 0) return [1960, 2026];
  let min = 2026;
  let max = 1960;
  for (const era of eras) {
    if (era === "Classic (pre-2000)") {
      min = Math.min(min, 1960);
      max = Math.max(max, 1999);
    } else if (era === "2000–2020") {
      min = Math.min(min, 2000);
      max = Math.max(max, 2020);
    } else if (era === "Recent (2021–2026)") {
      min = Math.min(min, 2021);
      max = Math.max(max, 2026);
    }
  }
  return [min, max];
}

function combinedLanguageCodes(a: Preferences, b: Preferences): string[] {
  const names = new Set([...a.languages, ...b.languages]);
  if (names.has("Any")) return [];
  return [...names].map((n) => LANGUAGE_ISO[n]).filter(Boolean);
}

function describePrefs(label: string, p: Preferences): string {
  return `${label}: moods=[${p.mood.join(", ")}]; free text="${p.moodFreetext || "(none)"}"; languages=[${p.languages.join(", ")}]; content type=${p.contentType}; min rating=${p.minRating}+; eras=[${p.eras.join(", ")}]`;
}

async function callBriefModel(prompt: string): Promise<SearchBrief> {
  const res = await fetch(`${GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
        responseSchema: BRIEF_RESPONSE_SCHEMA,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Gemini request failed: ${res.status} ${await res.text()}`);
  }

  const json = await res.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini did not return a brief");

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("Gemini returned malformed JSON for the brief");
  }

  const parsed = BriefSchema.safeParse(raw);
  if (!parsed.success) throw new Error("Brief failed validation: " + parsed.error.message);
  return parsed.data;
}

export async function generateRoundOneBrief(
  prefsA: Preferences,
  prefsB: Preferences,
  pairHistorySummary?: string
): Promise<SearchBrief> {
  const yearRangeA = eraToYearRange(prefsA.eras);
  const yearRangeB = eraToYearRange(prefsB.eras);
  const yearRange: [number, number] = [
    Math.min(yearRangeA[0], yearRangeB[0]),
    Math.max(yearRangeA[1], yearRangeB[1]),
  ];
  const languages = combinedLanguageCodes(prefsA, prefsB);
  const minRating = Math.max(prefsA.minRating, prefsB.minRating);
  const contentTypes =
    prefsA.contentType === "movies" && prefsB.contentType === "movies"
      ? ["movie"]
      : ["movie", "tv"];

  const prompt = `Two partners are picking something to watch together tonight. Build ONE search
brief that satisfies both people's tastes and moods at once, weighting the free-text mood
descriptions heavily since that's where the real nuance is.

${describePrefs("Partner A", prefsA)}
${describePrefs("Partner B", prefsB)}
${pairHistorySummary ? `\nThis pair's history: ${pairHistorySummary}\n` : ""}

Hard constraints you must respect in the brief: languages=[${languages.join(", ") || "any"}],
media_types=[${contentTypes.join(", ")}], year_range must be exactly [${yearRange[0]}, ${yearRange[1]}]
(an array of exactly two numbers), min_rating=${minRating}.

Reconcile both moods in genres/keywords/exclude (e.g. if one wants "Scary" and the other wants
"Light & fun", lean toward genres like horror-comedy rather than picking one person's mood and
ignoring the other). Use their free-text descriptions to pick specific keywords, not just broad
genres. Respond with JSON only, matching the given schema exactly.`;

  return callBriefModel(prompt);
}

export async function generateRoundTwoBrief(
  originalBrief: SearchBrief,
  likedTitlesA: { title: string; genres: string[] }[],
  likedTitlesB: { title: string; genres: string[] }[]
): Promise<SearchBrief> {
  const describeLiked = (label: string, titles: { title: string; genres: string[] }[]) =>
    titles.length
      ? `${label} right-swiped: ${titles.map((t) => `${t.title} (${t.genres.join("/")})`).join(", ")}`
      : `${label} right-swiped nothing this round`;

  const prompt = `Round 1 of swiping ended with no match. Here is the original brief and what
each partner actually swiped right on. Refine the brief to lean into the overlap in what they
responded to, while still respecting the original hard constraints (languages=${JSON.stringify(originalBrief.languages)},
media_types=${JSON.stringify(originalBrief.media_types)}, year_range must stay exactly
${JSON.stringify(originalBrief.year_range)} (two numbers), min_rating=${originalBrief.min_rating}).

Original mood summary: ${originalBrief.mood_summary}
${describeLiked("Partner A", likedTitlesA)}
${describeLiked("Partner B", likedTitlesB)}

Produce an adjusted genres/keywords list that's more likely to produce a title both of them
would swipe right on this time. Respond with JSON only, matching the given schema exactly.`;

  return callBriefModel(prompt);
}
