import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = getSupabaseServerClient();

  const { data: session, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("code", code.toUpperCase())
    .single();

  if (error || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const { data: prefs } = await supabase
    .from("preferences")
    .select("partner")
    .eq("session_id", session.id);

  const submitted = new Set((prefs ?? []).map((p) => p.partner));

  return NextResponse.json({
    id: session.id,
    code: session.code,
    pairId: session.pair_id,
    status: session.status,
    round: session.round,
    hasPartnerB: Boolean(session.partner_b_device_id),
    aSubmitted: submitted.has("a"),
    bSubmitted: submitted.has("b"),
  });
}
