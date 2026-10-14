import { CI_BADGE, type ModuleCi } from "@/lib/capstone/ci-badge";

/** Icon + text badge for a module's capstone branch; never colour alone. */
export function CiBadge({ ci }: { ci: ModuleCi }) {
  const b = CI_BADGE[ci.state];
  const badge = (
    <span
      role="img"
      aria-label={ci.ariaLabel}
      title={ci.ariaLabel}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${b.cls}`}
    >
      <span aria-hidden>{b.icon}</span>
      <span aria-hidden>{b.label}</span>
    </span>
  );
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      {ci.runUrl ? (
        <a href={ci.runUrl} target="_blank" rel="noreferrer" className="hover:opacity-80">
          {badge}
        </a>
      ) : (
        badge
      )}
      <span className="font-mono text-[11px] text-neutral-500">{ci.branch}</span>
    </span>
  );
}
