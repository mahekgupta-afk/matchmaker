import { z } from "zod";

export const MOODS = [
  "Light & fun",
  "Intense & gripping",
  "Scary",
  "Romantic",
  "Other",
] as const;

export const LANGUAGES = [
  "Hindi",
  "English",
  "Tamil",
  "Telugu",
  "Kannada",
  "Any",
] as const;

export const ERAS = ["Any", "Classic (pre-2000)", "2000–2020", "Recent (2021–2026)"] as const;

export const CONTENT_TYPES = ["movies", "movies_and_series"] as const;

export const LANGUAGE_ISO: Record<string, string> = {
  Hindi: "hi",
  English: "en",
  Tamil: "ta",
  Telugu: "te",
  Kannada: "kn",
};

export type Partner = "a" | "b";

export const PreferencesSchema = z.object({
  mood: z.array(z.enum(MOODS)).min(1),
  moodFreetext: z.string().max(500).optional().default(""),
  languages: z.array(z.enum(LANGUAGES)).min(1),
  contentType: z.enum(CONTENT_TYPES),
  minRating: z.union([z.literal(6), z.literal(7), z.literal(8), z.literal(9)]),
  eras: z.array(z.enum(ERAS)).min(1),
});

export type Preferences = z.infer<typeof PreferencesSchema>;

export const BriefSchema = z.object({
  genres: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  exclude: z.array(z.string()).default([]),
  languages: z.array(z.string()).default([]),
  media_types: z.array(z.enum(["movie", "tv"])).default(["movie", "tv"]),
  year_range: z.tuple([z.number(), z.number()]).default([1960, 2026]),
  min_rating: z.number().default(6),
  mood_summary: z.string().default(""),
});

export type SearchBrief = z.infer<typeof BriefSchema>;

export const SwipeSchema = z.object({
  partner: z.enum(["a", "b"]),
  tmdbId: z.number().int().positive(),
  direction: z.enum(["like", "pass"]),
  round: z.number().int().positive(),
});

export const DoneSchema = z.object({
  partner: z.enum(["a", "b"]),
  round: z.number().int().positive(),
});

export const FinalPickSchema = z.object({
  partner: z.enum(["a", "b"]),
  tmdbId: z.number().int().positive(),
});

export const RatingSchema = z.object({
  partner: z.enum(["a", "b"]),
  tmdbId: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
  note: z.string().max(500).optional(),
});

export type SessionStatus =
  | "waiting_for_b"
  | "collecting_prefs"
  | "generating_brief"
  | "swiping"
  | "matched"
  | "final_pick"
  | "completed";

export interface SessionRow {
  id: string;
  code: string;
  pair_id: string | null;
  status: SessionStatus;
  round: number;
  partner_a_device_id: string;
  partner_b_device_id: string | null;
  partner_a_done_round: number;
  partner_b_done_round: number;
  created_at: string;
  updated_at: string;
}

export interface TitlePoolRow {
  id: string;
  session_id: string;
  round: number;
  tmdb_id: number;
  media_type: "movie" | "tv";
  title: string;
  year: number | null;
  poster_path: string | null;
  rating: number | null;
  runtime: number | null;
  synopsis: string | null;
  raw: Record<string, unknown>;
}

export interface MatchRow {
  id: string;
  session_id: string;
  round: number;
  tmdb_id: number;
  method: "match" | "final_pick";
  streaming: StreamingOption[] | null;
  matched_at: string;
}

export interface StreamingOption {
  service: string;
  logo: string;
  link: string;
  type: string;
}
