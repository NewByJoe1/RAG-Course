import { stageLabel, type PipelineStageId } from "@/content/pipeline";

export type GlossaryEntry = { id: string; term: string; definition: string; stage: PipelineStageId | null };

export function Glossary({ terms, heading = "Glossary", showHeading = true }: { terms: GlossaryEntry[]; heading?: string; showHeading?: boolean }) {
  if (!terms.length) return null;
  return (
    <section aria-label={heading} className="space-y-3">
      {showHeading && <h3 className="text-xl font-semibold tracking-tight">{heading}</h3>}
      <dl className="grid gap-3 sm:grid-cols-2">
        {terms.map((t) => (
          <div key={t.id} id={`term-${t.id}`} className="scroll-mt-20 rounded-xl border border-neutral-200 p-3 text-sm dark:border-neutral-800">
            <dt className="font-semibold">{t.term}</dt>
            <dd className="mt-1 text-neutral-700 dark:text-neutral-300">{t.definition}</dd>
            {t.stage && <dd className="mt-1 font-mono text-xs text-neutral-500">{stageLabel(t.stage)}</dd>}
          </div>
        ))}
      </dl>
    </section>
  );
}
