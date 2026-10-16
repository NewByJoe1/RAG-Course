// Route access rules shared by middleware and tests.

// /api/cron authenticates with CRON_SECRET; unsubscribe links are HMAC-signed.
const PUBLIC_PREFIXES = ["/login", "/signup", "/auth", "/failures", "/glossary", "/unsubscribe", "/api/cron", "/api/reminders"];
const AUTH_PAGES = ["/login", "/signup"];

function matches(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isPublicPath(pathname: string): boolean {
  return pathname === "/" || PUBLIC_PREFIXES.some((p) => matches(pathname, p));
}

export function isAuthPage(pathname: string): boolean {
  return AUTH_PAGES.some((p) => matches(pathname, p));
}

/**
 * Module slug a path is gated by: /modules/<slug>[/...], plus /capstone,
 * which is the capstone module's (m12) page. Otherwise null.
 */
export function moduleSlugFromPath(pathname: string): string | null {
  if (pathname === "/capstone" || pathname.startsWith("/capstone/")) return "capstone";
  const m = /^\/modules\/([a-z0-9-]+)(?:\/.*)?$/.exec(pathname);
  return m ? m[1] : null;
}

/**
 * Only allow same-origin relative redirects ("/x"), never "//host" or
 * "/\host", which browsers treat as protocol-relative URLs.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}

export type GateResult = {
  module_id: string;
  slug: string;
  unlocked: boolean;
  prev_slug: string | null;
} | null;

export type AccessDecision =
  | { action: "next" }
  | { action: "redirect"; to: string };

/**
 * Decide what middleware should do for a request. `gate` is only consulted for
 * /modules/<slug> requests from signed-in users; pass `"error"` if the gate
 * lookup failed, which fails closed.
 */
export function decideAccess(args: {
  pathname: string;
  search?: string;
  signedIn: boolean;
  gate?: GateResult | "error";
}): AccessDecision {
  const { pathname, search = "", signedIn, gate } = args;

  if (signedIn && isAuthPage(pathname)) return { action: "redirect", to: "/" };

  if (!signedIn) {
    if (isPublicPath(pathname)) return { action: "next" };
    return { action: "redirect", to: `/login?next=${encodeURIComponent(pathname + search)}` };
  }

  const slug = moduleSlugFromPath(pathname);
  if (!slug || gate === undefined) return { action: "next" };
  if (gate === "error") return { action: "redirect", to: `/?gate_error=${encodeURIComponent(slug)}` };
  if (gate === null) return { action: "next" }; // unknown module: let the page 404
  if (gate.unlocked) return { action: "next" };

  const to = gate.prev_slug ? `/modules/${gate.prev_slug}` : "/";
  return { action: "redirect", to: `${to}?locked=${encodeURIComponent(slug)}` };
}
