import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * The module's study guide as a narration script (one paragraph per point),
 * ready for the video pilot. Same access as the lesson (middleware gates
 * /modules/<slug>/*).
 */
export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  const supabase = createClient();
  const { data: mod } = await supabase.from("modules").select("id, order_index, title, hook").eq("slug", params.slug).maybeSingle();
  if (!mod) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data: points } = await supabase
    .from("study_guide_points")
    .select("point, narration, order_index")
    .eq("module_id", mod.id)
    .order("order_index");
  if (!points?.length) return NextResponse.json({ error: "no study guide" }, { status: 404 });

  const md = [
    `# Module ${mod.order_index}: ${mod.title} (narration script)`,
    "",
    ...(mod.hook ? [`> ${mod.hook}`, ""] : []),
    ...points.flatMap((p, i) => [`## ${i + 1}. ${p.point}`, "", p.narration, ""]),
  ].join("\n");

  return new NextResponse(md, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${mod.id}-study-guide.md"`,
    },
  });
}
