"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import type { StreamingOption, TitlePoolRow } from "@/lib/types";

const TMDB_IMG = "https://image.tmdb.org/t/p/w500";

interface Props {
  title: TitlePoolRow;
  streaming: StreamingOption[];
  imdbRating: number | null;
  onRate: (rating: number, note: string) => void;
  rated: boolean;
}

export default function MatchReveal({ title, streaming, imdbRating, onRate, rated }: Props) {
  const [rating, setRating] = useState(0);
  const [note, setNote] = useState("");

  return (
    <div className="flex flex-col items-center gap-6 px-4 py-8 text-center">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 14 }}
      >
        <p className="text-sm font-semibold uppercase tracking-widest text-rose-500">It&apos;s a match</p>
      </motion.div>

      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-xl"
      >
        {title.poster_path && (
          <img src={`${TMDB_IMG}${title.poster_path}`} alt={title.title} className="w-full object-cover" />
        )}
        <div className="p-5 text-left">
          <h2 className="text-2xl font-bold text-neutral-900">
            {title.title} {title.year && <span className="text-neutral-400">({title.year})</span>}
          </h2>
          <div className="mt-1 flex gap-3 text-sm text-neutral-500">
            {imdbRating != null ? (
              <span>★ {imdbRating.toFixed(1)} IMDb</span>
            ) : (
              title.rating != null && <span>★ {title.rating.toFixed(1)} TMDB</span>
            )}
            {title.runtime && <span>{title.runtime} min</span>}
            <span className="uppercase">{title.media_type === "movie" ? "Movie" : "Series"}</span>
          </div>
          {title.synopsis && <p className="mt-3 text-sm text-neutral-700">{title.synopsis}</p>}
        </div>
      </motion.div>

      <div className="w-full max-w-sm">
        <p className="mb-2 text-sm font-semibold text-neutral-800">Watch it now on</p>
        {streaming.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Not currently on a major Indian streaming platform — worth checking for rental/purchase.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {streaming.map((opt) => (
              <a
                key={opt.service}
                href={opt.link}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
              >
                {opt.service} ↗
              </a>
            ))}
          </div>
        )}
      </div>

      {!rated && (
        <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-4">
          <p className="mb-2 text-sm font-semibold text-neutral-800">Watched it? Rate it</p>
          <div className="mb-3 flex justify-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setRating(n)}
                className={`text-2xl ${n <= rating ? "text-amber-400" : "text-neutral-300"}`}
              >
                ★
              </button>
            ))}
          </div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Quick note (optional)"
            className="mb-3 w-full rounded-lg border border-neutral-300 p-2 text-sm"
          />
          <button
            disabled={rating === 0}
            onClick={() => onRate(rating, note)}
            className="w-full rounded-full bg-rose-500 py-2 text-sm font-semibold text-white disabled:opacity-30"
          >
            Save rating
          </button>
        </div>
      )}
      {rated && <p className="text-sm text-emerald-600">Thanks — saved for next time.</p>}
    </div>
  );
}
