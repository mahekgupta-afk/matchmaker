"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import TopFivePicker from "@/components/TopFivePicker";
import { getMyPartnerRole } from "@/lib/session-client";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { TitlePoolRow } from "@/lib/types";

export default function FinalPickPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const role = getMyPartnerRole(code);
  const [top5, setTop5] = useState<TitlePoolRow[] | null>(null);
  const [myPick, setMyPick] = useState<number | null>(null);
  const [partnerPick, setPartnerPick] = useState<number | null>(null);

  const fetchPicks = useCallback(async () => {
    const res = await fetch(`/api/sessions/${code}/final-five?partner=${role ?? ""}`);
    if (!res.ok) return;
    const data = await res.json();
    setTop5(data.top5 ?? []);
    setMyPick(data.myPick ?? null);
    setPartnerPick(data.partnerPick ?? null);
  }, [code, role]);

  useEffect(() => {
    let cancelled = false;
    let channelBound = false;

    async function poll() {
      const res = await fetch(`/api/sessions/${code}`);
      if (!res.ok || cancelled) return;
      const data = await res.json();
      if (data.status === "matched") router.push(`/session/${code}/match`);
      else await fetchPicks();

      if (!channelBound && data.id) {
        channelBound = true;
        const supabase = getSupabaseBrowserClient();
        supabase
          .channel(`final:${data.id}`)
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
  }, [code, router, fetchPicks]);

  async function handlePick(tmdbId: number) {
    setMyPick(tmdbId);
    const res = await fetch(`/api/sessions/${code}/final-pick`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partner: role, tmdbId }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.matched) {
      router.push(`/session/${code}/match`);
      return;
    }
    if (typeof data.partnerPick === "number") setPartnerPick(data.partnerPick);
  }

  if (!top5) {
    return <div className="flex flex-1 items-center justify-center text-neutral-400">Loading…</div>;
  }

  return (
    <TopFivePicker titles={top5} myPick={myPick} partnerPick={partnerPick} onPick={handlePick} />
  );
}
