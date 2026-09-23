"use client";

import { AnimatePresence } from "framer-motion";
import { useMemo, useState } from "react";
import SwipeCard from "./SwipeCard";
import type { TitlePoolRow } from "@/lib/types";

function shuffledCopy<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

interface Props {
  titles: TitlePoolRow[];
  round: number;
  onSwipe: (title: TitlePoolRow, direction: "like" | "pass") => void;
  onFinished: () => void;
}

export default function SwipeDeck({ titles, round, onSwipe, onFinished }: Props) {
  const ordered = useMemo(() => shuffledCopy(titles), [titles]);
  const [index, setIndex] = useState(0);

  function handleSwipe(direction: "like" | "pass") {
    const title = ordered[index];
    onSwipe(title, direction);
    const next = index + 1;
    setIndex(next);
    if (next >= ordered.length) onFinished();
  }

  const remaining = ordered.slice(index, index + 3);
  const total = ordered.length;

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between px-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Round {round}
        </span>
        <span className="text-xs font-medium text-neutral-500">
          {Math.min(index + 1, total)} / {total}
        </span>
      </div>

      <div className="relative flex-1">
        {remaining.length === 0 && (
          <div className="flex h-full items-center justify-center text-neutral-400">
            All caught up
          </div>
        )}
        <AnimatePresence>
          {remaining
            .map((title, i) => (
              <SwipeCard
                key={title.tmdb_id}
                title={title}
                isTop={i === 0}
                onSwipe={handleSwipe}
              />
            ))
            .reverse()}
        </AnimatePresence>
      </div>

      <div className="mt-6 flex items-center justify-center gap-6">
        <button
          onClick={() => handleSwipe("pass")}
          disabled={index >= total}
          className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-rose-300 text-2xl text-rose-500 shadow-sm active:scale-90 disabled:opacity-30"
          aria-label="Pass"
        >
          ✕
        </button>
        <button
          onClick={() => handleSwipe("like")}
          disabled={index >= total}
          className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-emerald-300 text-2xl text-emerald-500 shadow-sm active:scale-90 disabled:opacity-30"
          aria-label="Like"
        >
          ♥
        </button>
      </div>
    </div>
  );
}
