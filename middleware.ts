import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { decideAccess, moduleSlugFromPath, type GateResult } from "@/lib/auth/routes";

export async function middleware(request: NextRequest) {
  const { supabase, user, response } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  let gate: GateResult | "error" | undefined;
  const slug = moduleSlugFromPath(pathname);
  if (user && slug) {
    const { data, error } = await supabase.rpc("module_gate", { p_slug: slug }).maybeSingle<NonNullable<GateResult>>();
    if (error) {
      // Fails closed below; log so a missing function or bad grant is diagnosable.
      console.error(`[middleware] module_gate(${slug}) failed: ${error.code} ${error.message}`);
      gate = "error";
    } else {
      gate = data ?? null;
    }
  }

  const decision = decideAccess({ pathname, search, signedIn: Boolean(user), gate });
  if (decision.action === "next") return response();

  // Carry refreshed session cookies over to the redirect.
  const redirect = NextResponse.redirect(new URL(decision.to, request.url));
  response().cookies.getAll().forEach((c) => redirect.cookies.set(c));
  return redirect;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
