import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { RatingSchema } from "@/lib/types";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const parsed = RatingSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { partner, tmdbId, rating, note } = parsed.data;

  const supabase = getSupabaseServerClient();
  const { data: session, error } = await supabase
    .from("sessions")
    .select("id")
    .eq("code", code.toUpperCase())
    .single();
  if (error || !session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const { error: upsertError } = await supabase
    .from("ratings")
    .upsert(
      { session_id: session.id, partner, tmdb_id: tmdbId, rating, note },
      { onConflict: "session_id,tmdb_id,partner" }
    );
  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });

  await supabase.from("sessions").update({ status: "completed" }).eq("id", session.id);

  return NextResponse.json({ ok: true });
}
