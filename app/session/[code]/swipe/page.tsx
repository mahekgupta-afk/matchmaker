"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import SwipeDeck from "@/components/SwipeDeck";
import { getMyPartnerRole } from "@/lib/session-client";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { TitlePoolRow } from "@/lib/types";

export default function SwipePage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const role = getMyPartnerRole(code);

  const [round, setRound] = useState(1);
  const [pool, setPool] = useState<TitlePoolRow[] | null>(null);
  const [waitingOnPartner, setWaitingOnPartner] = useState(false);
  const loadedRoundRef = useRef<number | null>(null);

  const fetchPool = useCallback(async (r: number) => {
    const res = await fetch(`/api/sessions/${code}/pool?round=${r}`);
    if (!res.ok) return;
    const { pool: rows } = await res.json();
    setPool(rows);
    loadedRoundRef.current = r;
    setWaitingOnPartner(false);
  }, [code]);

  useEffect(() => {
    let cancelled = false;
    let channelBound = false;

    async function poll() {
      const res = await fetch(`/api/sessions/${code}`);
      if (!res.ok || cancelled) return;
      const data = await res.json();
      setRound(data.round);

      if (data.status === "matched") router.push(`/session/${code}/match`);
      else if (data.status === "final_pick") router.push(`/session/${code}/final-pick`);

      if (!channelBound && data.id) {
        channelBound = true;
        const supabase = getSupabaseBrowserClient();
        supabase
          .channel(`swipe:${data.id}`)
          .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${data.id}` },
            () => poll()
          )
          .subscribe();
      }
    }

    poll();
    const interval = setInterval(poll, 2500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [code, router]);

  useEffect(() => {
    if (loadedRoundRef.current !== round) fetchPool(round);
  }, [round, fetchPool]);

  async function handleSwipe(title: TitlePoolRow, direction: "like" | "pass") {
    const res = await fetch(`/api/sessions/${code}/swipes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partner: role, tmdbId: title.tmdb_id, direction, round }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.matched) router.push(`/session/${code}/match`);
  }

  async function handleFinished() {
    setWaitingOnPartner(true);
    const res = await fetch(`/api/sessions/${code}/done`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partner: role, round }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.status === "final_pick") router.push(`/session/${code}/final-pick`);
    else if (data.status === "swiping" && data.round > round) {
      setRound(data.round);
    }
  }

  if (!pool) {
    return <div className="flex flex-1 items-center justify-center text-neutral-400">Loading tonight&apos;s picks…</div>;
  }

  if (waitingOnPartner) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-rose-200 border-t-rose-500" />
        <h1 className="text-xl font-bold text-neutral-900">Waiting for your partner to finish…</h1>
        <p className="max-w-xs text-sm text-neutral-500">
          No match yet this round — hang tight while they finish swiping.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <SwipeDeck titles={pool} round={round} onSwipe={handleSwipe} onFinished={handleFinished} />
    </div>
  );
}
