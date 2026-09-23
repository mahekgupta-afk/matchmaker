import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { FinalPickSchema } from "@/lib/types";
import { topFiveByScore } from "@/lib/scoring";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const parsed = FinalPickSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { partner, tmdbId } = parsed.data;

  const supabase = getSupabaseServerClient();
  const { data: session, error } = await supabase
    .from("sessions")
    .select("id, round, status")
    .eq("code", code.toUpperCase())
    .single();
  if (error || !session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  if (session.status === "matched") {
    return NextResponse.json({ ok: true, matched: true });
  }

  const { data: pool } = await supabase.from("title_pool").select("*").eq("session_id", session.id);
  const { data: swipes } = await supabase.from("swipes").select("*").eq("session_id", session.id);
  const top5 = topFiveByScore(pool ?? [], swipes ?? []);
  if (!top5.some((t) => t.tmdb_id === tmdbId)) {
    return NextResponse.json({ error: "Title is not one of the final five" }, { status: 400 });
  }

  const { error: pickError } = await supabase
    .from("final_picks")
    .upsert({ session_id: session.id, partner, tmdb_id: tmdbId }, { onConflict: "session_id,partner" });
  if (pickError) return NextResponse.json({ error: pickError.message }, { status: 500 });

  const { data: picks } = await supabase
    .from("final_picks")
    .select("partner, tmdb_id")
    .eq("session_id", session.id);
  const pickA = picks?.find((p) => p.partner === "a");
  const pickB = picks?.find((p) => p.partner === "b");

  if (!pickA || !pickB) {
    return NextResponse.json({ ok: true, matched: false, waitingOnPartner: true });
  }

  if (pickA.tmdb_id !== pickB.tmdb_id) {
    return NextResponse.json({
      ok: true,
      matched: false,
      mismatch: true,
      yourPick: tmdbId,
      partnerPick: partner === "a" ? pickB.tmdb_id : pickA.tmdb_id,
    });
  }

  // Both partners agree — optimistic lock so a duplicate/concurrent request can't double-insert.
  const { data: locked } = await supabase
    .from("sessions")
    .update({ status: "matched" })
    .eq("id", session.id)
    .eq("status", "final_pick")
    .select()
    .maybeSingle();

  if (locked) {
    await supabase.from("matches").insert({
      session_id: session.id,
      round: session.round,
      tmdb_id: pickA.tmdb_id,
      method: "final_pick",
    });
  }

  return NextResponse.json({ ok: true, matched: true });
}
