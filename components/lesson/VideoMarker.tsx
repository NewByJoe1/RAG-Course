import { clipById } from "@/content/video-clips";

const SYSTEM: Record<string, string> = { mac: "Mac", windows: "Windows", linux: "Linux", any: "any computer" };

/** A spot where a how-to video will go. Shows what the clip will show until it's recorded. */
export function VideoMarker({ id }: { id: string }) {
  const clip = clipById(id);
  if (!clip) return null;
  return (
    <aside aria-label="Video coming soon" data-video={clip.id} className="flex gap-3 rounded-xl border border-dashed border-neutral-300 px-4 py-3 text-sm text-neutral-600 dark:border-neutral-700 dark:text-neutral-400">
      <span aria-hidden>🎬</span>
      <span>
        <span className="font-medium text-neutral-800 dark:text-neutral-200">Video coming soon:</span> {clip.shows}
        <span className="text-neutral-500"> ({SYSTEM[clip.system]})</span>
      </span>
    </aside>
  );
}
