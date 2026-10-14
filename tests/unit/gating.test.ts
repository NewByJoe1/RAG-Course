import { describe, expect, it } from "vitest";
import { computeModuleLocks } from "@/lib/course/gating";

const mods = [
  { id: "m03", order_index: 3 },
  { id: "m01", order_index: 1 },
  { id: "m02", order_index: 2 },
];

describe("computeModuleLocks", () => {
  it("unlocks only the first module for a new learner", () => {
    const locks = computeModuleLocks(mods, []);
    expect(locks.get("m01")).toEqual({ unlocked: true, prevModuleId: null });
    expect(locks.get("m02")).toEqual({ unlocked: false, prevModuleId: "m01" });
    expect(locks.get("m03")).toEqual({ unlocked: false, prevModuleId: "m02" });
  });

  it("unlocks the module after each passed one", () => {
    const locks = computeModuleLocks(mods, ["m01"]);
    expect(locks.get("m02")?.unlocked).toBe(true);
    expect(locks.get("m03")?.unlocked).toBe(false);
  });

  it("does not skip ahead: passing m02 alone doesn't unlock m02", () => {
    const locks = computeModuleLocks(mods, ["m02"]);
    expect(locks.get("m02")?.unlocked).toBe(false);
    expect(locks.get("m03")?.unlocked).toBe(true);
  });

  it("skips unpublished modules when finding the previous one", () => {
    const locks = computeModuleLocks(
      [
        { id: "m01", order_index: 1 },
        { id: "m02", order_index: 2, is_published: false },
        { id: "m03", order_index: 3 },
      ],
      ["m01"],
    );
    expect(locks.has("m02")).toBe(false);
    expect(locks.get("m03")).toEqual({ unlocked: true, prevModuleId: "m01" });
  });
});
