// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

type Data = Record<string, unknown[]>;
let data: Data;

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    from: (table: string) => {
      const q = { select: () => q, order: () => q, then: (r: (v: unknown) => void) => r({ data: data[table] ?? [], error: null }) };
      return q;
    },
  }),
}));

import MasteryPage from "@/app/mastery/page";

const MODULES = [
  { id: "m01", slug: "rag-foundations", title: "RAG Foundations", order_index: 1 },
  { id: "m02", slug: "pre-retrieval", title: "Pre-Retrieval", order_index: 2 },
  { id: "m03", slug: "hybrid-retrieval", title: "Retrieval", order_index: 3 },
  { id: "m04", slug: "post-retrieval", title: "Post-Retrieval", order_index: 4 },
];

const badgeIn = (title: string) => {
  const row = screen.getByText(new RegExp(title)).closest("tr")!;
  return within(row).getByRole("img", { name: /^CI for branch/ });
};

afterEach(cleanup);

describe("mastery grid CI badges", () => {
  it("shows passing, failing and no-runs states with text and an accessible label, not colour alone", async () => {
    data = {
      modules: MODULES,
      progress: [{ module_id: "m01", best_score: 1, passed_at: "2026-10-14T00:00:00Z" }],
      capstone_checks: [
        { check_key: "naive-rag", ci_status: "success", last_run_at: new Date(Date.now() - 2 * 3600e3).toISOString(), run_url: "https://github.com/o/r/actions/runs/1" },
        { check_key: "pre-retrieval", ci_status: "failure", last_run_at: new Date(Date.now() - 15 * 60e3).toISOString(), run_url: null },
        // hybrid-retrieval: no row at all → no runs yet
        { check_key: "post-retrieval", ci_status: "in_progress", last_run_at: new Date().toISOString(), run_url: null },
      ],
    };
    render(await MasteryPage());

    const passing = badgeIn("RAG Foundations");
    expect(passing).toHaveAccessibleName("CI for branch naive-rag: Passing, last run 2 h ago");
    expect(passing).toHaveTextContent("✓Passing");
    expect(passing.closest("a")).toHaveAttribute("href", "https://github.com/o/r/actions/runs/1");

    const failing = badgeIn("Pre-Retrieval");
    expect(failing).toHaveAccessibleName("CI for branch pre-retrieval: Failing, last run 15 min ago");
    expect(failing).toHaveTextContent("✗Failing");
    expect(failing.closest("a")).toBeNull();

    const none = badgeIn("3\\. Retrieval");
    expect(none).toHaveAccessibleName("CI for branch hybrid-retrieval: No runs yet");
    expect(none).toHaveTextContent("○No runs yet");

    const running = badgeIn("Post-Retrieval");
    expect(running).toHaveAccessibleName(/CI for branch post-retrieval: Running/);
  });

  it("shows no runs for every module when no repo is linked", async () => {
    data = { modules: MODULES, progress: [], capstone_checks: [] };
    render(await MasteryPage());
    const badges = screen.getAllByRole("img", { name: /^CI for branch/ });
    expect(badges).toHaveLength(4);
    for (const b of badges) expect(b).toHaveAccessibleName(/: No runs yet$/);
  });

  it("is display only: a passing branch doesn't unlock its module", async () => {
    data = {
      modules: MODULES,
      progress: [], // nothing passed: only Module 1 is unlocked
      capstone_checks: [{ check_key: "pre-retrieval", ci_status: "success", last_run_at: new Date().toISOString(), run_url: null }],
    };
    render(await MasteryPage());
    const row = screen.getByText(/2\. Pre-Retrieval/).closest("tr")!;
    expect(row).toHaveTextContent("🔒");
    expect(within(row).queryByRole("link", { name: /Pre-Retrieval/ })).toBeNull();
    expect(within(row).getByRole("img", { name: /^CI for branch/ })).toHaveAccessibleName(/Passing/);
  });
});
