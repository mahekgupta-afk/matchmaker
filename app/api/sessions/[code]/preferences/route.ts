import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { PreferencesSchema } from "@/lib/types";
import { startRoundOne } from "@/lib/rounds";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const body = await req.json();
  const { partner, preferences } = body as { partner: "a" | "b"; preferences: unknown };

  const parsed = PreferencesSchema.safeParse(preferences);
  if (!parsed.success || (partner !== "a" && partner !== "b")) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const { data: session, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("code", code.toUpperCase())
    .single();

  if (error || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const prefs = parsed.data;
  const { error: upsertError } = await supabase.from("preferences").upsert(
    {
      session_id: session.id,
      partner,
      mood: prefs.mood,
      mood_freetext: prefs.moodFreetext,
      languages: prefs.languages,
      content_type: prefs.contentType,
      min_rating: prefs.minRating,
      eras: prefs.eras,
    },
    { onConflict: "session_id,partner" }
  );

  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });

  const { data: allPrefs } = await supabase
    .from("preferences")
    .select("partner")
    .eq("session_id", session.id);

  const submitted = new Set((allPrefs ?? []).map((p) => p.partner));
  const bothSubmitted = submitted.has("a") && submitted.has("b");

  if (bothSubmitted && session.status !== "swiping") {
    await startRoundOne(session.id, session.pair_id);
    return NextResponse.json({ status: "swiping", bothSubmitted: true });
  }

  return NextResponse.json({ status: session.status, bothSubmitted });
}
