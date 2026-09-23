"use client";

import type { TitlePoolRow } from "@/lib/types";

const TMDB_IMG = "https://image.tmdb.org/t/p/w200";

export default function TopFivePicker({
  titles,
  myPick,
  partnerPick,
  onPick,
}: {
  titles: TitlePoolRow[];
  myPick: number | null;
  partnerPick: number | null;
  onPick: (tmdbId: number) => void;
}) {
  const titleFor = (tmdbId: number) => titles.find((t) => t.tmdb_id === tmdbId)?.title;
  const mismatch = myPick != null && partnerPick != null && myPick !== partnerPick;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="text-xl font-bold text-neutral-900">No match yet — you two decide</h1>
        <p className="text-sm text-neutral-500">
          Here are the 5 titles you both responded to most. Pick the same one to lock it in.
        </p>
      </div>

      {mismatch && (
        <div className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-700">
          You picked <span className="font-semibold">{titleFor(myPick!)}</span>, your partner
          picked <span className="font-semibold">{titleFor(partnerPick!)}</span>. Talk it over and
          both tap the same one.
        </div>
      )}
      {!mismatch && myPick != null && partnerPick == null && (
        <div className="rounded-2xl bg-rose-50 p-3 text-sm text-rose-600">
          You picked <span className="font-semibold">{titleFor(myPick)}</span> — waiting for your
          partner to choose.
        </div>
      )}

      <div className="flex flex-col gap-3">
        {titles.map((title) => {
          const isMine = myPick === title.tmdb_id;
          const isPartners = partnerPick === title.tmdb_id;
          return (
            <button
              key={title.tmdb_id}
              onClick={() => onPick(title.tmdb_id)}
              className={`flex items-center gap-3 rounded-2xl border bg-white p-3 text-left shadow-sm active:scale-[0.99] ${
                isMine ? "border-rose-400 ring-2 ring-rose-200" : "border-neutral-200"
              }`}
            >
              {title.poster_path && (
                <img
                  src={`${TMDB_IMG}${title.poster_path}`}
                  alt={title.title}
                  className="h-24 w-16 rounded-lg object-cover"
                />
              )}
              <div className="flex-1">
                <p className="font-semibold text-neutral-900">
                  {title.title} {title.year && <span className="text-neutral-400">({title.year})</span>}
                </p>
                <p className="text-xs text-neutral-500">
                  {title.rating != null && `★ ${title.rating.toFixed(1)} TMDB · `}
                  {title.media_type === "movie" ? "Movie" : "Series"}
                </p>
                {title.synopsis && (
                  <p className="mt-1 line-clamp-2 text-xs text-neutral-600">{title.synopsis}</p>
                )}
                {(isMine || isPartners) && (
                  <p className="mt-1 text-xs font-semibold text-rose-500">
                    {isMine && isPartners ? "You both picked this" : isMine ? "Your pick" : "Their pick"}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
