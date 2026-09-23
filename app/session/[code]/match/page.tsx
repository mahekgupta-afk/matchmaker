"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import MatchReveal from "@/components/MatchReveal";
import { getMyPartnerRole, setPairId } from "@/lib/session-client";
import type { StreamingOption, TitlePoolRow } from "@/lib/types";

export default function MatchPage() {
  const { code } = useParams<{ code: string }>();
  const role = getMyPartnerRole(code);
  const [title, setTitle] = useState<TitlePoolRow | null>(null);
  const [streaming, setStreaming] = useState<StreamingOption[]>([]);
  const [imdbRating, setImdbRating] = useState<number | null>(null);
  const [rated, setRated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    async function load() {
      const res = await fetch(`/api/sessions/${code}/match`);
      if (res.ok) {
        const data = await res.json();
        if (cancelled) return;
        setTitle(data.title);
        setStreaming(data.streaming ?? []);
        setImdbRating(typeof data.imdbRating === "number" ? data.imdbRating : null);
        if (data.pairId) setPairId(data.pairId);
        return;
      }
      attempts += 1;
      if (attempts < 10 && !cancelled) setTimeout(load, 800);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [code]);

  async function handleRate(rating: number, note: string) {
    if (!title) return;
    await fetch(`/api/sessions/${code}/rating`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partner: role, tmdbId: title.tmdb_id, rating, note }),
    });
    setRated(true);
  }

  if (!title) {
    return (
      <div className="flex flex-1 items-center justify-center text-neutral-400">
        Finding tonight&apos;s pick…
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <MatchReveal title={title} streaming={streaming} imdbRating={imdbRating} onRate={handleRate} rated={rated} />
    </div>
  );
}
