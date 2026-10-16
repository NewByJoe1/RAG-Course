import { CAPSTONE_SLUG } from "@/lib/capstone/view";
import { getLesson } from "@/lib/course/lesson-data";
import { LessonNav } from "@/components/lesson/LessonNav";

/**
 * The shared lesson layout: a tab sidebar on the left (a menu on phones) and
 * one page per tab. Modules not yet in the lesson format, and the capstone,
 * render their pages unchanged.
 */
export default async function ModuleLayout({ children, params }: { children: React.ReactNode; params: { slug: string } }) {
  if (params.slug === CAPSTONE_SLUG) return <>{children}</>;
  const lesson = await getLesson(params.slug);
  if (!lesson?.lessonFormat) return <>{children}</>;

  return (
    // Wider than the site's reading column, so the sidebar doesn't squeeze the page.
    <div style={{ width: "min(72rem, calc(100vw - 2rem))", marginLeft: "calc(50% - min(36rem, calc(50vw - 1rem)))" }}>
      <div className="gap-10 pt-6 md:grid md:grid-cols-[15rem_minmax(0,1fr)] md:pt-10">
        <div className="md:pb-10">
          <LessonNav moduleId={lesson.mod.id} moduleNumber={lesson.mod.order_index} title={lesson.mod.title} tabs={lesson.tabs} />
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
