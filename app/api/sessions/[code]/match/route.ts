import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { fetchImdbId } from "@/lib/tmdb";
import { fetchIndianStreamingOptions } from "@/lib/streaming";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = getSupabaseServerClient();

  const { data: session, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("code", code.toUpperCase())
    .single();
  if (error || !session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const { data: match } = await supabase
    .from("matches")
    .select("*")
    .eq("session_id", session.id)
    .order("matched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!match) return NextResponse.json({ error: "No match yet" }, { status: 404 });

  const { data: title } = await supabase
    .from("title_pool")
    .select("*")
    .eq("session_id", session.id)
    .eq("tmdb_id", match.tmdb_id)
    .order("round", { ascending: false })
    .limit(1)
    .maybeSingle();

  let streaming = match.streaming as unknown[] | null;
  let imdbRating = match.imdb_rating as number | null;
  if (!streaming) {
    const imdbId = title ? await fetchImdbId(title.media_type, title.tmdb_id) : null;
    const result = imdbId ? await fetchIndianStreamingOptions(imdbId) : { imdbRating: null, streaming: [] };
    streaming = result.streaming;
    imdbRating = result.imdbRating;
    await supabase.from("matches").update({ streaming, imdb_rating: imdbRating }).eq("id", match.id);
  }

  let pairId = session.pair_id as string | null;
  if (!pairId) {
    const { data: pair } = await supabase.from("pairs").insert({}).select().single();
    if (pair) {
      pairId = pair.id;
      await supabase.from("sessions").update({ pair_id: pairId }).eq("id", session.id);
    }
  }

  return NextResponse.json({ title, streaming, imdbRating, method: match.method, pairId });
}
