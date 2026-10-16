import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { modules } from "@/content";

const m01 = modules.find((m) => m.id === "m01")!;
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    from: (table: string) => {
      const data =
        table === "modules"
          ? { id: "m01", order_index: 1, title: m01.title, hook: m01.hook }
          : m01.study_guide!.map((p) => ({ point: p.point, narration: p.narration, order_index: p.order_index }));
      const q: Record<string, unknown> = {};
      for (const k of ["select", "eq", "order"]) q[k] = () => q;
      q.maybeSingle = async () => ({ data });
      q.then = (r: (v: unknown) => void) => r({ data });
      return q;
    },
  }),
}));

import { GET } from "@/app/modules/[slug]/study-guide/route";

describe("study guide narration export", () => {
  it("returns one narration paragraph per point as a markdown download", async () => {
    const res = await GET(new NextRequest("http://x/modules/rag-foundations/study-guide"), { params: { slug: "rag-foundations" } });
    expect(res.headers.get("content-type")).toContain("text/markdown");
    expect(res.headers.get("content-disposition")).toContain('filename="m01-study-guide.md"');
    const md = await res.text();
    expect(md.startsWith("# Module 1: RAG Foundations (narration script)")).toBe(true);
    expect(md).toContain(`> ${m01.hook}`);
    m01.study_guide!.forEach((p, i) => {
      expect(md).toContain(`## ${i + 1}. ${p.point}`);
      expect(md).toContain(p.narration);
    });
  });
});
