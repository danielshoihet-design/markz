import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assertSameOrigin,
  clientIp,
  isStrongPassword,
  isValidUuid,
  rateLimit,
} from "@/lib/security";

export async function POST(request: NextRequest) {
  try {
    if (!assertSameOrigin(request)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const ip = clientIp(request);
    const limited = rateLimit(`set-password:${ip}`, 20, 60_000);
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

    const managerLimited = rateLimit(`set-password-mgr:${user.id}`, 40, 60_000);
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
    const userId = String(raw.userId || "");
    const password = String(raw.password || "");

    if (!isValidUuid(userId)) {
      return NextResponse.json({ error: "Invalid user" }, { status: 400 });
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
    const { data: target } = await admin
      .from("profiles")
      .select("id, role")
      .eq("id", userId)
      .maybeSingle();

    if (!target || (target.role !== "client" && target.role !== "seller")) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { error } = await admin.auth.admin.updateUserById(userId, { password });
    if (error) {
      return NextResponse.json({ error: "Could not update password" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
