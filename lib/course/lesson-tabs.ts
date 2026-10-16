// The tabbed lesson: one page per tab, in this order. Shared by every module
// in the lesson format; a tab only appears when the module has its content.
//
//   overview · Part 1 … Part n · Practice · Go deeper · Hands-on · Glossary · Study guide · Module quiz
//
// The warm-up lives on the overview and the hands-on step(s) on their own
// tab, so "parts" are the remaining lesson steps.

export type LessonTabKey = string; // "overview", "part-1", "practice", …
export type LessonTab = { key: LessonTabKey; href: string; label: string };

type StepLite = { id: string; kind: string; title: string };

export const partSteps = <S extends StepLite>(steps: S[]) => steps.filter((s) => s.kind !== "warm_up" && s.kind !== "exercise");
export const handsOnSteps = <S extends StepLite>(steps: S[]) => steps.filter((s) => s.kind === "exercise");

/** Tab keys that aren't lesson parts. "study-guide" and "quiz" are taken by other routes. */
export const FIXED_TABS = ["practice", "go-deeper", "hands-on", "glossary", "study"] as const;

export function lessonTabs(m: {
  slug: string;
  title: string;
  steps: StepLite[];
  failures: number;
  glossary: number;
  studyPoints: number;
  quizItems: number;
}): LessonTab[] {
  const base = `/modules/${m.slug}`;
  const tab = (key: string, label: string): LessonTab => ({ key, href: `${base}/${key}`, label });
  return [
    { key: "overview", href: base, label: m.title },
    ...partSteps(m.steps).map((s, i) => tab(`part-${i + 1}`, s.title)),
    ...(m.failures ? [tab("practice", "Practice: when it goes wrong")] : []),
    tab("go-deeper", "Go deeper"),
    ...(handsOnSteps(m.steps).length ? [tab("hands-on", "Hands-on")] : []),
    ...(m.glossary ? [tab("glossary", "Glossary")] : []),
    ...(m.studyPoints ? [tab("study", "Study guide")] : []),
    ...(m.quizItems ? [tab("quiz", "Module quiz")] : []),
  ];
}

/** The tab a pathname belongs to (the quiz keeps its tab through ?q=… and sub-steps). */
export function currentTab(tabs: LessonTab[], pathname: string): LessonTab | null {
  const path = pathname.replace(/\/$/, "");
  return tabs.find((t) => t.href === path) ?? tabs.find((t) => t.key === "quiz" && path.startsWith(t.href)) ?? null;
}

export function neighbours(tabs: LessonTab[], key: LessonTabKey) {
  const i = tabs.findIndex((t) => t.key === key);
  return { prev: i > 0 ? tabs[i - 1] : null, next: i >= 0 && i < tabs.length - 1 ? tabs[i + 1] : null };
}
