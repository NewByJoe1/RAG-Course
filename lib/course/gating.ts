// Display-side unlock computation for lists of modules (home page, mastery
// grid). Mirrors public.module_gate(); the database stays authoritative.

export type ModuleOrder = { id: string; order_index: number; is_published?: boolean };

export type ModuleLock = { unlocked: boolean; prevModuleId: string | null };

export function computeModuleLocks(
  modules: ModuleOrder[],
  passedModuleIds: Iterable<string>,
): Map<string, ModuleLock> {
  const passed = new Set(passedModuleIds);
  const published = modules
    .filter((m) => m.is_published !== false)
    .sort((a, b) => a.order_index - b.order_index);

  const locks = new Map<string, ModuleLock>();
  published.forEach((m, i) => {
    const prev = i > 0 ? published[i - 1] : null;
    locks.set(m.id, { unlocked: !prev || passed.has(prev.id), prevModuleId: prev?.id ?? null });
  });
  return locks;
}
