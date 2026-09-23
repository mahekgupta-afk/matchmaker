import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const round = Number(req.nextUrl.searchParams.get("round") ?? "1");

  const supabase = getSupabaseServerClient();
  const { data: session, error } = await supabase
    .from("sessions")
    .select("id")
    .eq("code", code.toUpperCase())
    .single();

  if (error || !session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const { data: pool, error: poolError } = await supabase
    .from("title_pool")
    .select("*")
    .eq("session_id", session.id)
    .eq("round", round);

  if (poolError) return NextResponse.json({ error: poolError.message }, { status: 500 });

  return NextResponse.json({ pool: pool ?? [] });
}
