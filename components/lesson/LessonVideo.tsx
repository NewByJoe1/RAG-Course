export type LessonVideoData = { src: string; title: string; poster?: string; captions?: string };

/**
 * Pilot seam for one module's process video (the pipeline with the running
 * question flowing through it, with a guiding voiceover). Renders nothing
 * until a module's `video` is set; no module has one yet.
 */
export function LessonVideo({ video }: { video: LessonVideoData | null }) {
  if (!video) return null;
  return (
    <section aria-label={video.title} className="space-y-2">
      <h3 className="text-lg font-semibold tracking-tight">{video.title}</h3>
      <video controls preload="metadata" poster={video.poster} className="w-full rounded-xl border border-neutral-200 dark:border-neutral-800">
        <source src={video.src} />
        {video.captions && <track kind="captions" src={video.captions} srcLang="en" label="English" default />}
      </video>
    </section>
  );
}
