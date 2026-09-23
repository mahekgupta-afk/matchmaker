"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import PreferenceForm from "@/components/PreferenceForm";
import { getDeviceId, getPairId, setMyPartnerRole } from "@/lib/session-client";
import type { Preferences } from "@/lib/types";

export default function LandingPage() {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(preferences: Preferences) {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: getDeviceId(), pairId: getPairId(), preferences }),
      });
      if (!res.ok) throw new Error("Could not start a session. Try again.");
      const { code } = await res.json();
      setMyPartnerRole(code, "a");
      router.push(`/session/${code}/waiting`);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  if (starting) {
    return <PreferenceForm partnerLabel="You" onSubmit={handleSubmit} submitting={submitting} />;
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
      <div>
        <p className="text-sm font-semibold uppercase tracking-widest text-rose-500">
          Two people. One decision.
        </p>
        <h1 className="mt-3 text-4xl font-black leading-tight text-neutral-900">
          Stop scrolling.
          <br />
          Start watching.
        </h1>
        <p className="mt-4 text-base text-neutral-600">
          Tell us your mood, send your partner a link, swipe until you both land on the same
          thing — with exactly where to watch it tonight.
        </p>
      </div>
      {errorMsg && <p className="text-sm text-rose-500">{errorMsg}</p>}
      <button
        onClick={() => setStarting(true)}
        className="rounded-full bg-neutral-900 px-8 py-4 text-base font-semibold text-white shadow-lg active:scale-95"
      >
        Start tonight&apos;s session
      </button>
    </div>
  );
}
