import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { SwipeSchema } from "@/lib/types";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const parsed = SwipeSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { partner, tmdbId, direction, round } = parsed.data;

  const supabase = getSupabaseServerClient();
  const { data: session, error } = await supabase
    .from("sessions")
    .select("id, status")
    .eq("code", code.toUpperCase())
    .single();

  if (error || !session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  await supabase.from("swipes").upsert(
    { session_id: session.id, round, partner, tmdb_id: tmdbId, direction },
    { onConflict: "session_id,round,partner,tmdb_id" }
  );

  if (direction !== "like" || session.status === "matched") {
    return NextResponse.json({ matched: false });
  }

  const otherPartner = partner === "a" ? "b" : "a";
  const { data: otherLike } = await supabase
    .from("swipes")
    .select("id")
    .eq("session_id", session.id)
    .eq("round", round)
    .eq("partner", otherPartner)
    .eq("tmdb_id", tmdbId)
    .eq("direction", "like")
    .maybeSingle();

  if (!otherLike) return NextResponse.json({ matched: false });

  // Optimistic lock: only the request that wins this conditional update gets to record
  // the match, so two near-simultaneous mutual likes (on the same or different titles)
  // can't both insert a match row for this round.
  const { data: locked } = await supabase
    .from("sessions")
    .update({ status: "matched" })
    .eq("id", session.id)
    .eq("status", "swiping")
    .select()
    .maybeSingle();

  if (!locked) return NextResponse.json({ matched: false });

  const { error: matchError } = await supabase.from("matches").insert({
    session_id: session.id,
    round,
    tmdb_id: tmdbId,
    method: "match",
  });
  if (matchError) return NextResponse.json({ error: matchError.message }, { status: 500 });

  return NextResponse.json({ matched: true, tmdbId });
}
