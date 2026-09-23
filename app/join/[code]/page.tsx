"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import PreferenceForm from "@/components/PreferenceForm";
import { getDeviceId, setMyPartnerRole } from "@/lib/session-client";
import type { Preferences } from "@/lib/types";

export default function JoinPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [joinError, setJoinError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function join() {
      const res = await fetch(`/api/sessions/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: getDeviceId() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setJoinError(body.error ?? "This invite link isn't valid anymore.");
        return;
      }
      setMyPartnerRole(code, "b");
      setReady(true);
    }
    join();
  }, [code]);

  async function handleSubmit(preferences: Preferences) {
    setSubmitting(true);
    const res = await fetch(`/api/sessions/${code}/preferences`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partner: "b", preferences }),
    });
    if (!res.ok) {
      setJoinError("Could not save your preferences. Try again.");
      setSubmitting(false);
      return;
    }
    router.push(`/session/${code}/waiting`);
  }

  if (joinError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <p className="text-lg font-semibold text-neutral-900">{joinError}</p>
        <p className="text-sm text-neutral-500">Ask your partner to send a fresh invite.</p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center text-neutral-400">Joining…</div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <p className="rounded-2xl bg-rose-50 p-3 text-sm text-rose-600">
        You&apos;re matching with your partner tonight. Fill this in honestly — they won&apos;t
        see your answers.
      </p>
      <PreferenceForm partnerLabel="You" onSubmit={handleSubmit} submitting={submitting} />
    </div>
  );
}
