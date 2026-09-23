import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { topFiveByScore } from "@/lib/scoring";

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const partner = req.nextUrl.searchParams.get("partner");
  const supabase = getSupabaseServerClient();

  const { data: session, error } = await supabase
    .from("sessions")
    .select("id")
    .eq("code", code.toUpperCase())
    .single();
  if (error || !session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const { data: pool } = await supabase.from("title_pool").select("*").eq("session_id", session.id);
  const { data: swipes } = await supabase.from("swipes").select("*").eq("session_id", session.id);
  const { data: picks } = await supabase
    .from("final_picks")
    .select("partner, tmdb_id")
    .eq("session_id", session.id);

  const myPick = picks?.find((p) => p.partner === partner)?.tmdb_id ?? null;
  const otherPartner = partner === "a" ? "b" : "a";
  const partnerPick = picks?.find((p) => p.partner === otherPartner)?.tmdb_id ?? null;

  return NextResponse.json({ top5: topFiveByScore(pool ?? [], swipes ?? []), myPick, partnerPick });
}
