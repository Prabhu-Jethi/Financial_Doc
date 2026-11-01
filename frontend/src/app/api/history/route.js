import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server.js";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * GET /api/history - Retrieve user's cloud-persisted analysis history.
 */
export async function GET() {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ history: [] }, { status: 200 });
    }

    const { data, error } = await supabase
      .from("user_query_history")
      .select("id, question, company, reporting_periods, answer_text, citations, calculations, timings_ms, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.warn("[History API] Error fetching history:", error.message);
      return NextResponse.json({ history: [] }, { status: 200 });
    }

    // Format items to match frontend turn structure
    const formatted = (data || []).map((row) => ({
      history_id: row.id,
      question: row.question,
      company: row.company,
      period: row.reporting_periods?.[0] || "",
      reporting_periods: row.reporting_periods || [],
      timestamp: new Date(row.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      result: {
        question: row.question,
        company: row.company,
        reporting_periods: row.reporting_periods,
        answer_text: row.answer_text,
        citations: row.citations || [],
        facts: [],
        calculations: row.calculations || [],
        timings_ms: row.timings_ms || {},
        status: "answered",
      },
    }));

    return NextResponse.json({ history: formatted }, { status: 200 });
  } catch (err) {
    console.error("[History API] Internal error:", err);
    return NextResponse.json({ history: [] }, { status: 200 });
  }
}

/**
 * POST /api/history - Save completed analysis into user's cloud account forever.
 */
export async function POST(req) {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ detail: "Authentication required to persist query." }, { status: 401 });
    }

    const body = await req.json();
    if (!body.question || !body.answer_text) {
      return NextResponse.json({ detail: "Question and answer_text are required." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("user_query_history")
      .insert([
        {
          user_id: user.id,
          question: body.question,
          company: body.company || "All",
          reporting_periods: Array.isArray(body.reporting_periods) ? body.reporting_periods : [],
          answer_text: body.answer_text,
          citations: body.citations || [],
          calculations: body.calculations || [],
          timings_ms: body.timings_ms || {},
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("[History API] Insert error:", error);
      return NextResponse.json({ detail: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, item: data }, { status: 201 });
  } catch (err) {
    console.error("[History API] Internal error:", err);
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/history - Remove one history entry or clear all for authenticated user.
 */
export async function DELETE(req) {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ detail: "Authentication required." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const historyId = searchParams.get("id");

    let query = supabase.from("user_query_history").delete().eq("user_id", user.id);

    if (historyId) {
      query = query.eq("id", historyId);
    }

    const { error } = await query;
    if (error) {
      return NextResponse.json({ detail: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

