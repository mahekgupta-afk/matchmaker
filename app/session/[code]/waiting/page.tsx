"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import QRShare from "@/components/QRShare";
import { getMyPartnerRole } from "@/lib/session-client";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { SessionStatus } from "@/lib/types";

interface SessionInfo {
  id: string;
  status: SessionStatus;
  round: number;
  hasPartnerB: boolean;
  aSubmitted: boolean;
  bSubmitted: boolean;
}

export default function WaitingPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const role = getMyPartnerRole(code);

  useEffect(() => {
    let cancelled = false;
    let channelBound = false;

    async function poll() {
      const res = await fetch(`/api/sessions/${code}`);
      if (!res.ok || cancelled) return;
      const data: SessionInfo = await res.json();
      setInfo(data);

      if (!channelBound && data.id) {
        channelBound = true;
        const supabase = getSupabaseBrowserClient();
        supabase
          .channel(`waiting:${data.id}`)
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
  }, [code]);

  useEffect(() => {
    if (!info) return;
    if (info.status === "swiping") router.push(`/session/${code}/swipe`);
    else if (info.status === "matched") router.push(`/session/${code}/match`);
    else if (info.status === "final_pick") router.push(`/session/${code}/final-pick`);
  }, [info, code, router]);

  if (!info) {
    return <div className="flex flex-1 items-center justify-center text-neutral-400">Loading…</div>;
  }

  const joinUrl =
    typeof window !== "undefined" ? `${window.location.origin}/join/${code}` : "";

  const mySubmitted = role === "a" ? info.aSubmitted : info.bSubmitted;
  const theirSubmitted = role === "a" ? info.bSubmitted : info.aSubmitted;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      {role === "a" && !info.hasPartnerB && (
        <>
          <h1 className="text-2xl font-bold text-neutral-900">Bring your partner in</h1>
          <p className="max-w-xs text-sm text-neutral-600">
            Have them scan this QR code, or send the link — they&apos;ll land in the same
            session and fill this out on their own.
          </p>
          <QRShare url={joinUrl} />
        </>
      )}

      {(info.hasPartnerB || role === "b") && !mySubmitted && (
        <p className="text-neutral-600">Finish your preferences to continue.</p>
      )}

      {mySubmitted && !theirSubmitted && (
        <>
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-rose-200 border-t-rose-500" />
          <h1 className="text-xl font-bold text-neutral-900">Waiting on your partner…</h1>
          <p className="max-w-xs text-sm text-neutral-500">
            The moment they submit, we&apos;ll build tonight&apos;s shortlist and drop you both
            into swiping at the same time.
          </p>
        </>
      )}

      {mySubmitted && theirSubmitted && info.status !== "swiping" && (
        <>
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-rose-200 border-t-rose-500" />
          <h1 className="text-xl font-bold text-neutral-900">Curating tonight&apos;s picks…</h1>
          <p className="max-w-xs text-sm text-neutral-500">
            We&apos;re combining both your moods into a shortlist from TMDB. One moment.
          </p>
        </>
      )}
    </div>
  );
}
