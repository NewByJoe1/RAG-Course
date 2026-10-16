import { createClient } from "@/lib/supabase/server";
import { Glossary, type GlossaryEntry } from "@/components/lesson/Glossary";

export const metadata = { title: "Glossary · RAG Course" };

export default async function GlossaryPage() {
  const supabase = createClient();
  const { data } = await supabase.from("glossary_terms").select("id, term, definition, stage").order("term");
  return (
    <div className="space-y-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Glossary</h1>
      <p className="text-neutral-600 dark:text-neutral-400">Every term the course uses, with the pipeline stage it belongs to.</p>
      <Glossary terms={(data ?? []) as GlossaryEntry[]} heading="All terms" />
    </div>
  );
}
