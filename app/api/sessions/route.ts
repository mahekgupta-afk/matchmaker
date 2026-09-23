import { NextRequest, NextResponse } from "next/server";
import { customAlphabet } from "nanoid";
import { getSupabaseServerClient } from "@/lib/supabase";
import { PreferencesSchema } from "@/lib/types";

const genCode = customAlphabet("23456789ABCDEFGHJKMNPQRSTUVWXYZ", 6);

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { deviceId, pairId, preferences } = body as {
    deviceId: string;
    pairId?: string | null;
    preferences: unknown;
  };

  const parsed = PreferencesSchema.safeParse(preferences);
  if (!deviceId || !parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const code = genCode();

  const { data: session, error } = await supabase
    .from("sessions")
    .insert({ code, partner_a_device_id: deviceId, pair_id: pairId ?? null })
    .select()
    .single();

  if (error || !session) {
    return NextResponse.json({ error: error?.message ?? "Failed to create session" }, { status: 500 });
  }

  const prefs = parsed.data;
  const { error: prefError } = await supabase.from("preferences").insert({
    session_id: session.id,
    partner: "a",
    mood: prefs.mood,
    mood_freetext: prefs.moodFreetext,
    languages: prefs.languages,
    content_type: prefs.contentType,
    min_rating: prefs.minRating,
    eras: prefs.eras,
  });

  if (prefError) {
    return NextResponse.json({ error: prefError.message }, { status: 500 });
  }

  return NextResponse.json({ code, sessionId: session.id });
}
