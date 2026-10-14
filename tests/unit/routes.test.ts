import { describe, expect, it } from "vitest";
import { decideAccess, isPublicPath, moduleSlugFromPath, safeNextPath } from "@/lib/auth/routes";

describe("isPublicPath", () => {
  it.each(["/", "/login", "/signup", "/auth/callback", "/failures", "/failures/x", "/unsubscribe", "/api/cron/review-reminders", "/api/reminders/unsubscribe"])("%s is public", (p) => {
    expect(isPublicPath(p)).toBe(true);
  });
  it.each(["/modules/rag-foundations", "/mastery", "/review", "/streak", "/api/other", "/loginx", "/failuresx"])("%s is protected", (p) => {
    expect(isPublicPath(p)).toBe(false);
  });
});

describe("moduleSlugFromPath", () => {
  it("extracts the slug", () => {
    expect(moduleSlugFromPath("/modules/rag-foundations")).toBe("rag-foundations");
    expect(moduleSlugFromPath("/modules/rag-foundations/quiz")).toBe("rag-foundations");
  });
  it("ignores other paths", () => {
    expect(moduleSlugFromPath("/modules")).toBeNull();
    expect(moduleSlugFromPath("/mastery")).toBeNull();
    expect(moduleSlugFromPath("/modules/Bad_Slug")).toBeNull();
  });
});

describe("safeNextPath", () => {
  it("keeps same-origin relative paths", () => {
    expect(safeNextPath("/modules/x?y=1")).toBe("/modules/x?y=1");
  });
  it.each([null, undefined, "", "https://evil.example", "//evil.example", "/\\evil.example", "modules"])(
    "rejects %s",
    (v) => expect(safeNextPath(v)).toBe("/"),
  );
});

describe("decideAccess", () => {
  const gate = (unlocked: boolean, prev_slug: string | null = "rag-foundations") => ({
    module_id: "m02",
    slug: "next-module",
    unlocked,
    prev_slug,
  });

  it("lets anonymous users see public pages", () => {
    expect(decideAccess({ pathname: "/failures", signedIn: false })).toEqual({ action: "next" });
  });

  it("sends anonymous users to login with a return path", () => {
    expect(decideAccess({ pathname: "/modules/rag-foundations", search: "?a=1", signedIn: false })).toEqual({
      action: "redirect",
      to: "/login?next=%2Fmodules%2Frag-foundations%3Fa%3D1",
    });
    expect(decideAccess({ pathname: "/mastery", signedIn: false })).toMatchObject({ action: "redirect" });
  });

  it("sends signed-in users away from login and signup", () => {
    expect(decideAccess({ pathname: "/login", signedIn: true })).toEqual({ action: "redirect", to: "/" });
    expect(decideAccess({ pathname: "/signup", signedIn: true })).toEqual({ action: "redirect", to: "/" });
  });

  it("allows an unlocked module", () => {
    expect(decideAccess({ pathname: "/modules/next-module", signedIn: true, gate: gate(true) })).toEqual({ action: "next" });
  });

  it("redirects a locked module to the module that unlocks it", () => {
    expect(decideAccess({ pathname: "/modules/next-module", signedIn: true, gate: gate(false) })).toEqual({
      action: "redirect",
      to: "/modules/rag-foundations?locked=next-module",
    });
  });

  it("lets unknown modules through so the page can 404", () => {
    expect(decideAccess({ pathname: "/modules/nope", signedIn: true, gate: null })).toEqual({ action: "next" });
  });

  it("fails closed when the gate lookup errors", () => {
    expect(decideAccess({ pathname: "/modules/next-module", signedIn: true, gate: "error" })).toEqual({
      action: "redirect",
      to: "/?gate_error=next-module",
    });
  });
});
