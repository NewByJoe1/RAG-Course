import { notFound } from "next/navigation";
import { getLesson } from "@/lib/course/lesson-data";
import { handsOnSteps, partSteps } from "@/lib/course/lesson-tabs";
import type { PipelineStageId } from "@/content/pipeline";
import { PipelineDiagram } from "@/components/pipeline/PipelineDiagram";
import { WorkedExample } from "@/components/lesson/WorkedExample";
import { LessonVideo, type LessonVideoData } from "@/components/lesson/LessonVideo";
import { Glossary } from "@/components/lesson/Glossary";
import { ExplainBack } from "@/components/lesson/ExplainBack";
import { StudyGuide } from "@/components/lesson/StudyGuide";
import { FailureCases } from "@/components/lesson/FailureCases";
import { LessonPager, StepBody, TabHeader } from "@/components/lesson/LessonPage";
import { SetupCheck } from "@/components/lesson/SetupCheck";
import { createClient } from "@/lib/supabase/server";
import { partSteps as setupParts } from "@/lib/course/lesson-tabs";

// Tabs 2 onwards of a lesson-format module: /modules/<slug>/<page>, where
// <page> is part-1 … part-n, practice, go-deeper, hands-on, glossary or study.
// ("quiz" and "study-guide" are their own routes.) Access is enforced by the
// middleware, which gates every /modules/<slug>/* path.
export default async function LessonTabPage({ params }: { params: { slug: string; page: string } }) {
  const lesson = await getLesson(params.slug);
  if (!lesson?.lessonFormat || !lesson.tabs.some((t) => t.key === params.page)) notFound();
  const { mod } = lesson;
  const kicker = `Module ${mod.order_index} · ${mod.title}`;

  let body: React.ReactNode;
  const part = /^part-(\d+)$/.exec(params.page);
  if (part) {
    const parts = partSteps(lesson.steps);
    const n = Number(part[1]);
    const s = parts[n - 1];
    body = (
      <>
        <TabHeader kicker={`Part ${n} of ${parts.length}`} title={s.title} />
        <StepBody s={s} />
      </>
    );
  } else if (params.page === "practice") {
    body = (
      <>
        <TabHeader
          kicker="Practice"
          title="When it goes wrong"
          intro="Three ways the subcontractor question goes wrong. For each one, read what came back and pick the cause before you reveal it."
        />
        <FailureCases cases={lesson.failures} heading={false} />
      </>
    );
  } else if (params.page === "go-deeper") {
    body = (
      <>
        <TabHeader kicker="Go deeper" title="See it, then follow it step by step" intro="Where this module fits in the full pipeline, and the subcontractor question traced one stage at a time." />
        <div className="space-y-14">
          <PipelineDiagram current={(mod.pipeline_stages ?? []) as PipelineStageId[]} moduleId={mod.id} />
          <WorkedExample steps={lesson.worked} />
          <LessonVideo video={(mod.video as LessonVideoData | null) ?? null} />
        </div>
      </>
    );
  } else if (params.page === "hands-on") {
    const steps = handsOnSteps(lesson.steps);
    body = (
      <>
        <TabHeader kicker="Hands-on" title={steps[0].title} intro="Three short tasks, one at a time. Finish one to unlock the next." />
        {steps.map((s, i) => (
          <div key={s.id} className="space-y-4">
            {i > 0 && <h2 className="text-2xl font-semibold tracking-tight">{s.title}</h2>}
            <StepBody s={s} />
          </div>
        ))}
      </>
    );
  } else if (params.page === "glossary") {
    body = (
      <>
        <TabHeader
          kicker={kicker}
          title="Glossary"
          intro="Every word this module uses, in plain language. In the lesson, underlined words show the same definition when you hover or tap them."
        />
        <Glossary terms={lesson.terms} showHeading={false} />
        <p className="text-sm text-neutral-500">
          Looking for a word from another module?{" "}
          <a href="/glossary" className="underline">
            See the whole course glossary
          </a>
          .
        </p>
      </>
    );
  } else if (params.page === "study") {
    body = (
      <>
        <TabHeader kicker="Remember" title="Study guide" intro="The points to remember. Check your warm-up answers against them, then explain it back in your own words." />
        <StudyGuide points={lesson.points} scriptHref={`/modules/${mod.slug}/study-guide`} heading={false} />
        {mod.explain_back_prompt && lesson.user && <ExplainBack moduleId={mod.id} prompt={mod.explain_back_prompt} previous={lesson.lastExplain} />}
      </>
    );
  } else if (params.page === "setup-check" && lesson.isSetup) {
    const { data: next } = await createClient()
      .from("modules")
      .select("slug")
      .gt("order_index", mod.order_index)
      .order("order_index")
      .limit(1)
      .maybeSingle();
    body = (
      <>
        <TabHeader kicker={kicker} title="Check your setup" intro="Run through these once more. When they all work, tick the box: that unlocks Module 1. There's no quiz here." />
        <SetupCheck
          checks={setupParts(lesson.steps).map((s) => s.title)}
          doneAt={lesson.progress?.passed_at ?? null}
          nextHref={next ? `/modules/${next.slug}` : "/"}
        />
      </>
    );
  } else notFound();

  return (
    <article className="space-y-10 pb-16">
      {body}
      <LessonPager tabs={lesson.tabs} current={params.page} />
    </article>
  );
}
