import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { startRoundTwo } from "@/lib/rounds";
import { topFiveByScore } from "@/lib/scoring";
import { DoneSchema } from "@/lib/types";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const parsed = DoneSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { partner, round } = parsed.data;

  const supabase = getSupabaseServerClient();
  const { data: session, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("code", code.toUpperCase())
    .single();

  if (error || !session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  if (session.status !== "swiping" || session.round !== round) {
    return NextResponse.json({ status: session.status, round: session.round });
  }

  const doneField = partner === "a" ? "partner_a_done_round" : "partner_b_done_round";
  await supabase.from("sessions").update({ [doneField]: round }).eq("id", session.id);

  const { data: refreshed } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", session.id)
    .single();

  const bothDone =
    refreshed && refreshed.partner_a_done_round >= round && refreshed.partner_b_done_round >= round;

  if (!bothDone) return NextResponse.json({ status: "swiping", round, bothDone: false });

  // Optimistic lock: only the request that wins this conditional update proceeds.
  const { data: locked } = await supabase
    .from("sessions")
    .update({ status: "generating_brief" })
    .eq("id", session.id)
    .eq("status", "swiping")
    .select()
    .maybeSingle();

  if (!locked) {
    const { data: current } = await supabase.from("sessions").select("status, round").eq("id", session.id).single();
    return NextResponse.json({ status: current?.status ?? "swiping", round: current?.round ?? round, bothDone: true });
  }

  if (round === 1) {
    await startRoundTwo(session.id);
    return NextResponse.json({ status: "swiping", round: 2, bothDone: true });
  }

  const { data: pool } = await supabase.from("title_pool").select("*").eq("session_id", session.id);
  const { data: swipes } = await supabase.from("swipes").select("*").eq("session_id", session.id);
  const top5 = topFiveByScore(pool ?? [], swipes ?? []);

  await supabase.from("sessions").update({ status: "final_pick" }).eq("id", session.id);

  return NextResponse.json({ status: "final_pick", round, bothDone: true, top5 });
}
