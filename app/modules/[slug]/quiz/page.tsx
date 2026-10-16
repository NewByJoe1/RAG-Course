import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CAPSTONE_PATH, CAPSTONE_SLUG } from "@/lib/capstone/view";
import { QuizRunner, type QuizRunnerItem } from "@/components/quiz/QuizRunner";

export const metadata = { title: "Quiz · RAG Course" };

// Sign-in and unlock are enforced by middleware (it gates /modules/<slug>/*)
// and, on submit, by public.submit_module_quiz(); neither changes here.
export default async function QuizPage({ params, searchParams }: { params: { slug: string }; searchParams: { q?: string } }) {
  if (params.slug === CAPSTONE_SLUG) redirect(CAPSTONE_PATH);

  const supabase = createClient();
  const { data: mod } = await supabase.from("modules").select("id, slug, title").eq("slug", params.slug).maybeSingle();
  if (!mod) notFound();

  const { data: items } = await supabase
    .from("quiz_items")
    .select("id, kind, prompt, choices, order_index")
    .eq("module_id", mod.id)
    .order("order_index");
  if (!items?.length) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-10">
      <Link href={`/modules/${mod.slug}`} className="text-sm underline">
        ← Back to the lesson
      </Link>
      <QuizRunner moduleId={mod.id} slug={mod.slug} moduleTitle={mod.title} items={items as QuizRunnerItem[]} initialPosition={searchParams.q} />
    </div>
  );
}
