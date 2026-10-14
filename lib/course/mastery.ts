import { computeModuleLocks, type ModuleOrder } from "./gating";

export type MasteryLevel = "unseen" | "learning" | "correct" | "mastered";

export type Attempt = { quiz_item_id: string; is_correct: boolean; attempted_at: string };

/**
 * unseen   - never attempted
 * learning - most recent attempt was wrong
 * correct  - most recent attempt right
 * mastered - two most recent attempts both right
 */
export function masteryLevel(attempts: Attempt[]): MasteryLevel {
  if (attempts.length === 0) return "unseen";
  const [latest, previous] = [...attempts].sort((a, b) => b.attempted_at.localeCompare(a.attempted_at));
  if (!latest.is_correct) return "learning";
  return previous?.is_correct ? "mastered" : "correct";
}

export type GridModule = ModuleOrder & { slug: string; title: string };
export type GridItem = { id: string; module_id: string; order_index: number; prompt: string };
export type GridProgress = { module_id: string; best_score: number | null; passed_at: string | null };

export type MasteryRow = {
  module: GridModule;
  unlocked: boolean;
  passed: boolean;
  bestScore: number | null;
  cells: { item: GridItem; level: MasteryLevel; attempts: number }[];
  masteredCount: number;
};

export function buildMasteryGrid(
  modules: GridModule[],
  items: GridItem[],
  attempts: Attempt[],
  progress: GridProgress[],
): MasteryRow[] {
  const passedIds = progress.filter((p) => p.passed_at).map((p) => p.module_id);
  const locks = computeModuleLocks(modules, passedIds);
  const progressBy = new Map(progress.map((p) => [p.module_id, p]));

  const attemptsBy = new Map<string, Attempt[]>();
  for (const a of attempts) {
    const list = attemptsBy.get(a.quiz_item_id) ?? [];
    list.push(a);
    attemptsBy.set(a.quiz_item_id, list);
  }

  return [...modules]
    .filter((m) => locks.has(m.id))
    .sort((a, b) => a.order_index - b.order_index)
    .map((module) => {
      const cells = items
        .filter((i) => i.module_id === module.id)
        .sort((a, b) => a.order_index - b.order_index)
        .map((item) => {
          const list = attemptsBy.get(item.id) ?? [];
          return { item, level: masteryLevel(list), attempts: list.length };
        });
      const p = progressBy.get(module.id);
      return {
        module,
        unlocked: locks.get(module.id)!.unlocked,
        passed: Boolean(p?.passed_at),
        bestScore: p?.best_score ?? null,
        cells,
        masteredCount: cells.filter((c) => c.level === "mastered").length,
      };
    });
}
