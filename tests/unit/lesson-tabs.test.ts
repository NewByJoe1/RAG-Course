import { describe, expect, it } from "vitest";
import { currentTab, lessonTabs, neighbours } from "@/lib/course/lesson-tabs";

const steps = [
  { id: "s1", kind: "warm_up", title: "Warm-up" },
  { id: "s2", kind: "concept", title: "One" },
  { id: "s3", kind: "exercise", title: "Hands-on" },
  { id: "s4", kind: "concept", title: "Two" },
];
const tabs = lessonTabs({ slug: "x", title: "Module X", steps, failures: 3, glossary: 4, studyPoints: 3, quizItems: 7 });

describe("lessonTabs", () => {
  it("builds overview, parts (no warm-up or hands-on), then the fixed tabs, quiz last", () => {
    expect(tabs.map((t) => t.key)).toEqual(["overview", "part-1", "part-2", "practice", "go-deeper", "hands-on", "glossary", "study", "quiz"]);
    expect(tabs[0]).toEqual({ key: "overview", href: "/modules/x", label: "Module X" });
    expect(tabs[2]).toEqual({ key: "part-2", href: "/modules/x/part-2", label: "Two" });
  });

  it("leaves out tabs a module has no content for", () => {
    const bare = lessonTabs({ slug: "x", title: "X", steps: steps.filter((s) => s.kind !== "exercise"), failures: 0, glossary: 0, studyPoints: 0, quizItems: 0 });
    expect(bare.map((t) => t.key)).toEqual(["overview", "part-1", "part-2", "go-deeper"]);
  });

  it("finds the current tab and its neighbours", () => {
    expect(currentTab(tabs, "/modules/x/")?.key).toBe("overview");
    expect(currentTab(tabs, "/modules/x/glossary")?.key).toBe("glossary");
    expect(currentTab(tabs, "/modules/x/quiz")?.key).toBe("quiz");
    expect(currentTab(tabs, "/modules/x/nope")).toBeNull();
    expect(neighbours(tabs, "overview")).toEqual({ prev: null, next: tabs[1] });
    expect(neighbours(tabs, "quiz")).toEqual({ prev: tabs[7], next: null });
  });
});
