import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assertSameOrigin,
  clientIp,
  isStrongPassword,
  rateLimit,
  sanitizeText,
} from "@/lib/security";
import { isValidUsername, normalizeUsername, usernameToAuthEmail } from "@/lib/username";

export async function POST(request: NextRequest) {
  try {
    if (!assertSameOrigin(request)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const ip = clientIp(request);
    const limited = rateLimit(`create-user:${ip}`, 10, 60_000);
    if (!limited.ok) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "manager") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const managerLimited = rateLimit(`create-user-mgr:${user.id}`, 30, 60_000);
    if (!managerLimited.ok) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const raw = body as Record<string, unknown>;
    const fullName = sanitizeText(String(raw.fullName || ""), 120);
    const username = normalizeUsername(String(raw.username || ""));
    const password = String(raw.password || "");
    const role = raw.role === "seller" ? "seller" : "client";

    if (!fullName || fullName.length < 2) {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }
    if (!isValidUsername(username)) {
      return NextResponse.json(
        { error: "Invalid username (2–32 chars: letters, numbers, . _ -)" },
        { status: 400 },
      );
    }
    if (!isStrongPassword(password)) {
      return NextResponse.json(
        {
          error:
            "Password must be at least 10 characters and include upper, lower, and a number",
        },
        { status: 400 },
      );
    }

    const admin = createAdminClient();

    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .ilike("username", username)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: "Username already taken" }, { status: 409 });
    }

    const email = usernameToAuthEmail(username);
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role,
        locale: "he",
        username,
      },
    });

    if (error) {
      return NextResponse.json({ error: "Could not create user" }, { status: 400 });
    }

    if (data.user) {
      await admin
        .from("profiles")
        .update({
          full_name: fullName,
          role,
          email,
          username,
        })
        .eq("id", data.user.id);
    }

    return NextResponse.json({ ok: true, id: data.user?.id, username });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
