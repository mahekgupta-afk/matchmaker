import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { deviceId } = (await req.json()) as { deviceId: string };
  if (!deviceId) return NextResponse.json({ error: "Missing deviceId" }, { status: 400 });

  const supabase = getSupabaseServerClient();
  const { data: session, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("code", code.toUpperCase())
    .single();

  if (error || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.partner_b_device_id === deviceId) {
    return NextResponse.json({ sessionId: session.id, status: "collecting_prefs" });
  }

  if (session.partner_b_device_id) {
    return NextResponse.json({ error: "This session already has two partners" }, { status: 409 });
  }

  // Compare-and-swap: only claim the partner-B slot if it's still empty, so two
  // simultaneous scans of the same invite can't silently overwrite each other.
  const { data: claimed, error: updateError } = await supabase
    .from("sessions")
    .update({ partner_b_device_id: deviceId, status: "collecting_prefs" })
    .eq("id", session.id)
    .is("partner_b_device_id", null)
    .select()
    .maybeSingle();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  if (!claimed) {
    // Lost the race — check whether it was actually our own concurrent request (e.g. a
    // duplicate submit or React double-invoking an effect) that won, before reporting an error.
    const { data: current } = await supabase
      .from("sessions")
      .select("partner_b_device_id")
      .eq("id", session.id)
      .single();
    if (current?.partner_b_device_id === deviceId) {
      return NextResponse.json({ sessionId: session.id, status: "collecting_prefs" });
    }
    return NextResponse.json({ error: "This session already has two partners" }, { status: 409 });
  }

  return NextResponse.json({ sessionId: session.id, status: "collecting_prefs" });
}
