// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { answerReviewCard, rateReviewCard } = vi.hoisted(() => ({ answerReviewCard: vi.fn(), rateReviewCard: vi.fn() }));
vi.mock("@/app/actions/review", () => ({ answerReviewCard, rateReviewCard }));

import { CauseReveal } from "@/components/failures/CauseReveal";
import { ReviewSession, type SessionCard } from "@/components/review/ReviewSession";
import { orderCauseOptions } from "@/lib/course/causes";

const options = [
  { id: "a", text: "Vector search alone matched loose similarity" },
  { id: "b", text: "The BM25 index was never built" },
  { id: "c", text: "The chunk size was too small" },
];
const ROOT = "Vector search alone matched loose similarity, with no keyword signal to anchor it.";
const FIX = "Use hybrid retrieval.";

beforeEach(() => rateReviewCard.mockReset());
afterEach(cleanup);

describe("failure gallery: pick the cause before the reveal", () => {
  const renderCase = () => render(<CauseReveal caseId="m03-f01" rootCause={ROOT} fix={FIX} causeOptions={options} correctCause="a" />);

  it("hides the root cause and fix until a cause is checked", async () => {
    const user = userEvent.setup();
    renderCase();
    expect(screen.queryByText(ROOT)).toBeNull();
    expect(screen.queryByText(FIX)).toBeNull();
    const check = screen.getByRole("button", { name: "Check cause" });
    expect(check).toBeDisabled();

    await user.click(screen.getByRole("radio", { name: options[1].text }));
    await user.click(check);
    expect(screen.getByRole("status")).toHaveTextContent(`Not quite · The cause: ${options[0].text}`);
    expect(screen.getByText(ROOT)).toBeInTheDocument();
    expect(screen.getByText(FIX)).toBeInTheDocument();
    // Locked after checking.
    expect(screen.getByRole("radio", { name: options[0].text })).toBeDisabled();
  });

  it("confirms a correct pick", async () => {
    const user = userEvent.setup();
    renderCase();
    await user.click(screen.getByRole("radio", { name: options[0].text }));
    await user.click(screen.getByRole("button", { name: "Check cause" }));
    expect(screen.getByRole("status")).toHaveTextContent("Correct");
  });

  it("shows options in the case's stable shuffled order", () => {
    renderCase();
    const shown = screen.getAllByRole("radio").map((r) => (r as HTMLInputElement).value);
    expect(shown).toEqual(orderCauseOptions("m03-f01", options).map((o) => o.id));
  });

  it("reveals straight away for cases without options", () => {
    render(<CauseReveal caseId="m01-f01" rootCause={ROOT} fix={FIX} causeOptions={null} correctCause={null} />);
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.getByText(ROOT)).toBeInTheDocument();
  });
});

describe("failure-case review card with cause options", () => {
  const card: SessionCard = {
    type: "failure",
    id: "card-uuid-1",
    failureCaseId: "m03-f01",
    module: "Retrieval",
    previews: { again: "1d", hard: "2d", good: "7d", easy: "21d" },
    title: "The signature block",
    user_query: "Can we share this with a subcontractor?",
    retrieved_context: [],
    bad_output: "The top retrieved chunk is the signature block.",
    root_cause: ROOT,
    fix: FIX,
    cause_options: options,
    correct_cause: "a",
  };

  it("asks for the cause instead of a plain Show answer, then reveals", async () => {
    const user = userEvent.setup();
    render(<ReviewSession cards={[card]} remainingAfter={0} />);
    expect(screen.queryByRole("button", { name: "Show answer" })).toBeNull();
    expect(screen.queryByText(ROOT)).toBeNull();
    expect(screen.queryByRole("button", { name: /^Good/ })).toBeNull();

    await user.click(screen.getByRole("radio", { name: options[0].text }));
    await user.click(screen.getByRole("button", { name: "Check cause" }));
    expect(screen.getByText(ROOT)).toBeInTheDocument();
    for (const r of ["Again", "Hard", "Good", "Easy"]) expect(screen.getByRole("button", { name: new RegExp(`^${r}`) })).toBeEnabled();
  });

  it("allows only Again after a wrong cause", async () => {
    const user = userEvent.setup();
    rateReviewCard.mockResolvedValue({ status: "rated", rating: "again", intervalDays: 1, dueAt: "2026-10-16T00:00:00Z" });
    render(<ReviewSession cards={[card]} remainingAfter={0} />);
    await user.click(screen.getByRole("radio", { name: options[2].text }));
    await user.click(screen.getByRole("button", { name: "Check cause" }));
    for (const r of ["Hard", "Good", "Easy"]) expect(screen.getByRole("button", { name: new RegExp(`^${r}`) })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /^Again/ }));
    expect(rateReviewCard).toHaveBeenCalledWith("card-uuid-1", "again");
    expect(await screen.findByText(/Session complete: 1 card reviewed/)).toBeInTheDocument();
  });

  it("orders options the same as the gallery (by failure case, not review card)", () => {
    render(<ReviewSession cards={[card]} remainingAfter={0} />);
    const shown = screen.getAllByRole("radio").map((r) => (r as HTMLInputElement).value);
    expect(shown).toEqual(orderCauseOptions("m03-f01", options).map((o) => o.id));
  });
});
