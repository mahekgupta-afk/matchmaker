"use client";

import { motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import type { TitlePoolRow } from "@/lib/types";

const TMDB_IMG = "https://image.tmdb.org/t/p/w500";

interface Props {
  title: TitlePoolRow;
  isTop: boolean;
  onSwipe: (direction: "like" | "pass") => void;
}

export default function SwipeCard({ title, isTop, onSwipe }: Props) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-12, 12]);
  const likeOpacity = useTransform(x, [20, 120], [0, 1]);
  const passOpacity = useTransform(x, [-120, -20], [1, 0]);

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x > 120) onSwipe("like");
    else if (info.offset.x < -120) onSwipe("pass");
  }

  const runtimeLabel =
    title.runtime != null
      ? title.media_type === "movie"
        ? `${title.runtime} min`
        : `${title.runtime} min/ep`
      : null;

  return (
    <motion.div
      className="absolute inset-0"
      style={isTop ? { x, rotate } : undefined}
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={isTop ? handleDragEnd : undefined}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="relative flex h-full flex-col overflow-hidden rounded-3xl bg-white shadow-xl">
        <div className="relative flex-1 bg-neutral-200">
          {title.poster_path ? (
            <img
              src={`${TMDB_IMG}${title.poster_path}`}
              alt={title.title}
              className="h-full w-full object-cover"
              draggable={false}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-neutral-400">No poster</div>
          )}
          {isTop && (
            <>
              <motion.div
                style={{ opacity: likeOpacity }}
                className="absolute top-6 left-6 rounded-lg border-4 border-emerald-400 px-3 py-1 text-2xl font-black text-emerald-400"
              >
                LIKE
              </motion.div>
              <motion.div
                style={{ opacity: passOpacity }}
                className="absolute top-6 right-6 rounded-lg border-4 border-rose-400 px-3 py-1 text-2xl font-black text-rose-400"
              >
                PASS
              </motion.div>
            </>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-5 pt-16 text-white">
            <div className="flex items-baseline gap-2">
              <h2 className="text-xl font-bold leading-tight">{title.title}</h2>
              {title.year && <span className="text-sm text-white/70">{title.year}</span>}
            </div>
            <div className="mt-1 flex items-center gap-3 text-sm text-white/80">
              {title.rating != null && <span>★ {title.rating.toFixed(1)} TMDB</span>}
              {runtimeLabel && <span>{runtimeLabel}</span>}
              <span className="uppercase tracking-wide text-xs text-white/60">
                {title.media_type === "movie" ? "Movie" : "Series"}
              </span>
            </div>
            {title.synopsis && (
              <p className="mt-2 line-clamp-2 text-sm text-white/90">{title.synopsis}</p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
