import { NextResponse, type NextRequest } from "next/server";
import { unsubscribeFromReminders } from "@/lib/unsubscribe";

// RFC 8058 one-click unsubscribe (List-Unsubscribe-Post). Mail providers POST
// here; humans clicking the link in the email land on /unsubscribe instead.
export async function POST(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const ok = await unsubscribeFromReminders(p.get("u"), p.get("sig"));
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}
