// GET  /api/admin/raffle-requirements?round_id=123
// POST /api/admin/raffle-requirements  { round_id, mode, enabled, gates }
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const roundId = searchParams.get("round_id");

  const supabase = getSupabaseAdmin();

  if (roundId) {
    const { data, error } = await supabase
      .from("raffle_requirements")
      .select("*")
      .eq("round_id", Number(roundId))
      .maybeSingle();

    if (error) {
      console.error("raffle_requirements GET error", error);
      return NextResponse.json({ error: "DB error" }, { status: 500 });
    }
    return NextResponse.json({ data });
  }

  // Return all requirements (for list summaries)
  const { data, error } = await supabase
    .from("raffle_requirements")
    .select("round_id, mode, enabled, gates");

  if (error) {
    console.error("raffle_requirements GET all error", error);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
  return NextResponse.json({ data });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { round_id, mode, enabled, gates } = body;

  if (!round_id || !mode || !Array.isArray(gates)) {
    return NextResponse.json(
      { error: "round_id, mode, and gates are required" },
      { status: 400 }
    );
  }

  if (!["all", "any"].includes(mode)) {
    return NextResponse.json({ error: "mode must be 'all' or 'any'" }, { status: 400 });
  }

  if (gates.length === 0) {
    return NextResponse.json({ error: "At least one gate is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from("raffle_requirements")
    .upsert(
      { round_id: Number(round_id), mode, enabled: Boolean(enabled), gates },
      { onConflict: "round_id" }
    );

  if (error) {
    console.error("raffle_requirements upsert error", error);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
