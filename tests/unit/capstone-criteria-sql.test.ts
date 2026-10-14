import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { CRITERIA } from "@/supabase/functions/_shared/capstone";

// The six criteria are listed in three places: the app/poller (CRITERIA), the
// capstone_checks check constraint, and claim_capstone_mastery(). Keep them identical.
const sql = readFileSync(path.join(__dirname, "../../supabase/migrations/0004_capstone.sql"), "utf8");

const arraysIn = (text: string) =>
  Array.from(text.matchAll(/array\[((?:'[a-z_]+',?\s*)+)\]::text\[\]/g), (m) => Array.from(m[1].matchAll(/'([a-z_]+)'/g), (x) => x[1]));

describe("capstone criteria stay in sync", () => {
  it("the check constraint and the mastery function list exactly CRITERIA, in order", () => {
    const lists = arraysIn(sql);
    expect(lists).toHaveLength(2);
    for (const list of lists) expect(list).toEqual([...CRITERIA]);
  });

  it("has six criteria, with defence last", () => {
    expect(CRITERIA).toEqual(["recall", "citation", "isolation", "nightly", "kill_switch", "defence"]);
  });
});
