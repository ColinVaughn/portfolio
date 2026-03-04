import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!roleData || (roleData.role !== "integrator" && roleData.role !== "admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Generate a unique trial key
    const randomHex = crypto.randomBytes(4).toString("hex").toUpperCase();
    const trialKey = `TRIAL-${randomHex}-${user.id.substring(0, 8).toUpperCase()}`;

    const { data: trial, error } = await supabase
      .from("integrator_trials")
      .insert({
        integrator_id: user.id,
        trial_key: trialKey,
        status: "active"
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Attempt to revalidate the frontend cache so the table updates
    return NextResponse.json({ trial });
  } catch (error) {
    console.error("Trial Key generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate trial key" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: trials, error } = await supabase
      .from("integrator_trials")
      .select("*")
      .eq("integrator_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ trials });
  } catch (error) {
    console.error("Trial Key fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch trial keys" },
      { status: 500 }
    );
  }
}
