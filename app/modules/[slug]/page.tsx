import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CAPSTONE_PATH, CAPSTONE_SLUG } from "@/lib/capstone/view";
import { formatPercent } from "@/lib/course/quiz";
import { getLesson, type Lesson, type LessonStepRow } from "@/lib/course/lesson-data";
import { partSteps } from "@/lib/course/lesson-tabs";
import { Markdown } from "@/components/lesson/Markdown";
import { eyebrow, LessonPager } from "@/components/lesson/LessonPage";

function Status({ lesson, locked }: { lesson: Lesson; locked?: string }) {
  const { progress } = lesson;
  return (
    <>
      {locked && (
        <p role="status" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          {lesson.isSetup
            ? "Module 1 opens once your setup works. Go through these parts, then tick \"My setup works\" on the last tab."
            : "That module is locked. Pass this module's quiz to unlock it."}
        </p>
      )}
      {progress?.passed_at ? (
        <p className="text-sm font-medium text-green-700 dark:text-green-400">Passed · best score {formatPercent(progress.best_score)}</p>
      ) : progress?.best_score != null ? (
        <p className="text-sm text-neutral-500">Best score so far {formatPercent(progress.best_score)}</p>
      ) : null}
    </>
  );
}

function QuizCta({ slug, count }: { slug: string; count: number }) {
  if (!count) return null;
  return (
    <section className="max-w-2xl space-y-3 rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800">
      <h2 className="text-2xl font-semibold tracking-tight">Module quiz</h2>
      <p className="text-neutral-600 dark:text-neutral-400">{count} questions, one at a time. Score 80% or more to pass and unlock the next module.</p>
      <Link href={`/modules/${slug}/quiz`} className="inline-flex rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">
        Take the quiz →
      </Link>
    </section>
  );
}

/** Modules not yet in the lesson format: one long page, as before. */
function SinglePage({ lesson, locked }: { lesson: Lesson; locked?: string }) {
  const { mod } = lesson;
  return (
    <article className="space-y-10 py-10">
      <header className="space-y-3">
        <Status lesson={lesson} locked={locked} />
        <p className="text-sm font-medium text-neutral-500">Module {mod.order_index}</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{mod.title}</h1>
      </header>
      <p className="text-neutral-600 dark:text-neutral-400">{mod.summary}</p>
      {mod.learning_objectives.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {mod.learning_objectives.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      )}
      <section className="space-y-8">
        {lesson.steps.map((s: LessonStepRow) => (
          <div key={s.id} className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{s.kind}</p>
            <h3 className="text-xl font-semibold tracking-tight">{s.title}</h3>
            <Markdown text={s.body_md} />
            {s.code_snippet && (
              <pre className="overflow-x-auto rounded-xl bg-neutral-100 p-4 text-sm leading-relaxed dark:bg-neutral-900">
                <code>{s.code_snippet}</code>
              </pre>
            )}
          </div>
        ))}
      </section>
      <QuizCta slug={mod.slug} count={lesson.quizCount} />
    </article>
  );
}

// Access (sign-in + unlock) is enforced by middleware and, for quiz
// submission, by public.submit_module_quiz(). This page only renders.
export default async function ModulePage({ params, searchParams }: { params: { slug: string }; searchParams: { locked?: string } }) {
  // The capstone has no lessons or quiz; it lives on its own page.
  if (params.slug === CAPSTONE_SLUG) redirect(CAPSTONE_PATH);
  const lesson = await getLesson(params.slug);
  if (!lesson) notFound();
  if (!lesson.lessonFormat) return <SinglePage lesson={lesson} locked={searchParams.locked} />;

  // --- Tab 1, the overview: hook → objectives → warm-up → the parts ---------
  const { mod } = lesson;
  const warmUp = lesson.steps.find((s) => s.kind === "warm_up");
  const parts = partSteps(lesson.steps);

  return (
    <article className="space-y-14 pb-16">
      <div className="space-y-8">
        <header className="space-y-3">
          <Status lesson={lesson} locked={searchParams.locked} />
          <p className={eyebrow}>Module {mod.order_index}</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{mod.title}</h1>
        </header>
        <section aria-label="Why this matters" className="max-w-2xl">
          <p className="border-l-4 border-teal-700 pl-5 text-xl leading-relaxed text-neutral-900 dark:border-teal-400 dark:text-white">
            <Markdown text={mod.hook!} inline />
          </p>
        </section>
        <details className="max-w-2xl rounded-xl border border-neutral-200 px-4 py-3 text-sm dark:border-neutral-800">
          <summary className="cursor-pointer font-medium">What you&apos;ll be able to do</summary>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 leading-relaxed text-neutral-700 dark:text-neutral-300">
            {mod.learning_objectives.map((o) => (
              <li key={o}>
                <Markdown text={o} inline />
              </li>
            ))}
          </ul>
        </details>
      </div>

      {warmUp && (
        <section aria-label="Warm-up" className="max-w-2xl space-y-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <p className={eyebrow}>Before you start</p>
          <h2 className="text-xl font-semibold tracking-tight">{warmUp.title}</h2>
          <Markdown text={warmUp.body_md} />
        </section>
      )}

      <section aria-labelledby="learn-title" className="max-w-2xl space-y-5">
        <h2 id="learn-title" className="text-base font-semibold uppercase tracking-[0.14em] text-teal-700 dark:text-teal-400">
          Learn
        </h2>
        <ol className="space-y-1">
          {parts.map((s, i) => (
            <li key={s.id}>
              <Link
                href={`/modules/${mod.slug}/part-${i + 1}`}
                className="flex items-baseline gap-3 rounded-xl px-3 py-2.5 text-lg text-neutral-800 hover:bg-neutral-100 hover:text-neutral-950 dark:text-neutral-200 dark:hover:bg-neutral-900 dark:hover:text-white"
              >
                <span className="w-6 shrink-0 tabular-nums text-neutral-400">{i + 1}</span>
                {s.title}
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <LessonPager tabs={lesson.tabs} current="overview" />
    </article>
  );
}
