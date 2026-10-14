// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { CRITERIA, CAPSTONE_BRANCHES, type EvalResults } from "@/supabase/functions/_shared/capstone";

// The repo form uses react-dom's useFormState, which the test React build lacks.
vi.mock("@/components/capstone/RepoForm", () => ({
  RepoForm: ({ current }: { current: string | null }) => <div data-testid="repo-form">{current}</div>,
}));

type Row = { check_key: string; ci_status: string | null; last_run_at: string | null; run_url: string | null; criteria_met: string[]; results: EvalResults | null; error: string | null };
let rows: Row[];
let masteredAt: string | null;
const rpc = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    rpc: async (...args: unknown[]) => {
      rpc(...args);
      return { data: "2026-10-15T09:00:00Z", error: null };
    },
    from: (table: string) => {
      const result = () =>
        table === "profiles"
          ? { data: { github_repo: "NewByJoe1/capstone-test-2" }, error: null }
          : table === "progress"
            ? { data: masteredAt ? { mastered_at: masteredAt } : null, error: null }
            : { data: rows, error: null };
      const q = {
        select: () => q,
        eq: () => q,
        single: async () => result(),
        maybeSingle: async () => result(),
        then: (resolve: (v: unknown) => void) => resolve(result()),
      };
      return q;
    },
  }),
}));

import CapstonePage from "@/app/capstone/page";

const zeros: EvalResults = { branch: "main", recall_at_3: 0, citation_accuracy: 0, cross_tenant_leaks: 0, concurrent_users_tested: 0, nightly_runs: 0, kill_switch_tested: false };
const passing: EvalResults = { branch: "main", recall_at_3: 0.91, citation_accuracy: 0.97, cross_tenant_leaks: 0, concurrent_users_tested: 150, nightly_runs: 4, kill_switch_tested: true };
const FIVE = ["recall", "citation", "isolation", "nightly", "kill_switch"];

/** Rows shaped like the live data: main succeeded, the 11 stage branches have no runs. */
function liveLike(mainCriteria: string[], results: EvalResults): Row[] {
  return CAPSTONE_BRANCHES.map((b) =>
    b === "main"
      ? { check_key: "main", ci_status: "success", last_run_at: "2026-10-14T04:17:05Z", run_url: "https://github.com/x/y/actions/runs/1", criteria_met: mainCriteria, results, error: null }
      : { check_key: b, ci_status: "no_runs", last_run_at: null, run_url: null, criteria_met: [], results: null, error: null },
  );
}

async function renderPage() {
  render(await CapstonePage());
}
const checkbox = (label: string) => screen.getByRole("checkbox", { name: label }) as HTMLInputElement;
const LABELS = ["Recall", "Citation accuracy", "Tenant isolation", "Nightly evals", "Kill switch", "Defence"];

beforeEach(() => {
  rpc.mockReset();
  masteredAt = null;
});
afterEach(cleanup);

describe("/capstone reads the six pass criteria", () => {
  it("shows six criteria in order, all unmet for the live placeholder run (0/6)", async () => {
    rows = liveLike([], zeros);
    await renderPage();
    expect(LABELS).toHaveLength(CRITERIA.length);
    expect(screen.getAllByRole("checkbox").map((c) => c.getAttribute("aria-label"))).toEqual(LABELS);
    for (const l of LABELS) expect(checkbox(l).checked, l).toBe(false);
    expect(screen.getByText(/0\/6 met/)).toBeInTheDocument();
    // Each criterion shows the value measured in main's results.json.
    const card = (label: string) => checkbox(label).closest("li")!;
    expect(card("Recall")).toHaveTextContent("recall@3 ≥ 0.85 · now 0.00");
    expect(card("Citation accuracy")).toHaveTextContent("≥ 0.95 · now 0.00");
    expect(card("Tenant isolation")).toHaveTextContent("0 leaks · 0 users");
    expect(card("Nightly evals")).toHaveTextContent("now 0 runs");
    expect(card("Kill switch")).toHaveTextContent("now not tested");
    expect(card("Defence")).toHaveTextContent("signed off by a reviewer");
    expect(screen.queryByText(/Capstone passed/)).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("lists the 11 stage branches as rows, with main as the criteria source", async () => {
    rows = liveLike([], zeros);
    await renderPage();
    const table = screen.getByRole("table");
    const branchCells = within(table).getAllByRole("row").slice(1).map((r) => within(r).getAllByRole("cell")[0].textContent);
    expect(branchCells).toEqual(CAPSTONE_BRANCHES.filter((b) => b !== "main"));
    expect(within(table).getAllByText("No runs")).toHaveLength(11);
    expect(screen.getByText(/measured on/).textContent).toMatch(/Passing/);
  });

  it("ticks exactly the criteria main has met, and needs the reviewer's defence to pass", async () => {
    rows = liveLike(FIVE, passing);
    await renderPage();
    expect(LABELS.map((l) => checkbox(l).checked)).toEqual([true, true, true, true, true, false]);
    expect(screen.getByText(/5\/6 met/)).toBeInTheDocument();
    expect(screen.queryByText(/Capstone passed/)).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("ignores criteria met on other branches", async () => {
    rows = liveLike([], zeros).map((r) => (r.check_key === "rerank" ? { ...r, ci_status: "success", criteria_met: FIVE } : r));
    await renderPage();
    expect(LABELS.map((l) => checkbox(l).checked).filter(Boolean)).toHaveLength(0);
  });

  it("shows the passed banner and records mastery once all six are met", async () => {
    rows = liveLike([...FIVE, "defence"], passing);
    await renderPage();
    expect(LABELS.map((l) => checkbox(l).checked)).toEqual([true, true, true, true, true, true]);
    expect(screen.getByRole("status")).toHaveTextContent("Capstone passed");
    expect(screen.getByRole("status")).toHaveTextContent("mastered Oct 15, 2026");
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("claim_capstone_mastery");
  });

  it("doesn't re-record mastery that's already stored", async () => {
    rows = liveLike([...FIVE, "defence"], passing);
    masteredAt = "2026-10-01T12:00:00Z";
    await renderPage();
    expect(screen.getByRole("status")).toHaveTextContent("mastered Oct 1, 2026");
    expect(rpc).not.toHaveBeenCalled();
  });
});
