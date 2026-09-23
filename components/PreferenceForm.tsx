"use client";

import { useState } from "react";
import { ERAS, LANGUAGES, MOODS, type Preferences } from "@/lib/types";

interface Props {
  partnerLabel: string;
  onSubmit: (prefs: Preferences) => void;
  submitting: boolean;
}

const RATINGS = [6, 7, 8, 9] as const;
const CONTENT_OPTIONS: { value: Preferences["contentType"]; label: string }[] = [
  { value: "movies", label: "Movies only" },
  { value: "movies_and_series", label: "Include series" },
];

function toggleInArray<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-transparent bg-rose-500 text-white shadow-sm"
          : "border-neutral-300 bg-white text-neutral-700 hover:border-rose-300"
      }`}
    >
      {children}
    </button>
  );
}

export default function PreferenceForm({ partnerLabel, onSubmit, submitting }: Props) {
  const [mood, setMood] = useState<Preferences["mood"]>([]);
  const [moodFreetext, setMoodFreetext] = useState("");
  const [languages, setLanguages] = useState<Preferences["languages"]>([]);
  const [contentType, setContentType] = useState<Preferences["contentType"]>("movies");
  const [minRating, setMinRating] = useState<Preferences["minRating"]>(7);
  const [eras, setEras] = useState<Preferences["eras"]>([]);

  const toggleMood = (m: (typeof MOODS)[number]) => setMood((prev) => toggleInArray(prev, m));

  const toggleLanguage = (l: (typeof LANGUAGES)[number]) => {
    if (l === "Any") {
      setLanguages(["Any"]);
      return;
    }
    setLanguages((prev) => toggleInArray(prev.filter((v) => v !== "Any"), l));
  };

  const toggleEra = (e: (typeof ERAS)[number]) => {
    if (e === "Any") {
      setEras(["Any"]);
      return;
    }
    setEras((prev) => toggleInArray(prev.filter((v) => v !== "Any"), e));
  };

  const canSubmit = mood.length > 0 && languages.length > 0 && eras.length > 0 && !submitting;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        onSubmit({ mood, moodFreetext, languages, contentType, minRating, eras });
      }}
      className="flex flex-col gap-8"
    >
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {partnerLabel}
        </p>
        <h1 className="text-2xl font-bold text-neutral-900">What are you in the mood for?</h1>
      </div>

      <section className="flex flex-col gap-3">
        <label className="text-sm font-semibold text-neutral-800">Mood</label>
        <div className="flex flex-wrap gap-2">
          {MOODS.map((m) => (
            <Chip key={m} active={mood.includes(m)} onClick={() => toggleMood(m)}>
              {m}
            </Chip>
          ))}
        </div>
        <textarea
          value={moodFreetext}
          onChange={(e) => setMoodFreetext(e.target.value)}
          placeholder="Describe what you're in the mood for tonight (optional)"
          rows={2}
          maxLength={500}
          className="rounded-xl border border-neutral-300 p-3 text-sm focus:border-rose-400 focus:outline-none"
        />
      </section>

      <section className="flex flex-col gap-3">
        <label className="text-sm font-semibold text-neutral-800">Language</label>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((l) => (
            <Chip key={l} active={languages.includes(l)} onClick={() => toggleLanguage(l)}>
              {l}
            </Chip>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <label className="text-sm font-semibold text-neutral-800">Content type</label>
        <div className="flex flex-wrap gap-2">
          {CONTENT_OPTIONS.map((opt) => (
            <Chip key={opt.value} active={contentType === opt.value} onClick={() => setContentType(opt.value)}>
              {opt.label}
            </Chip>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <label className="text-sm font-semibold text-neutral-800">Minimum rating</label>
        <div className="flex flex-wrap items-center gap-2">
          {RATINGS.map((r) => (
            <Chip key={r} active={minRating === r} onClick={() => setMinRating(r)}>
              {r}+
            </Chip>
          ))}
          {minRating === 9 && (
            <span className="text-xs text-neutral-500">very few titles</span>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <label className="text-sm font-semibold text-neutral-800">Era</label>
        <div className="flex flex-wrap gap-2">
          {ERAS.map((e) => (
            <Chip key={e} active={eras.includes(e)} onClick={() => toggleEra(e)}>
              {e}
            </Chip>
          ))}
        </div>
      </section>

      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-2 rounded-full bg-neutral-900 px-6 py-3 text-base font-semibold text-white transition-opacity disabled:opacity-40"
      >
        {submitting ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}
