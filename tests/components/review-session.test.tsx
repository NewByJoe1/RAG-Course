// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { parseQuizFormData } from "@/lib/course/quiz";

const { answerReviewCard, rateReviewCard } = vi.hoisted(() => ({ answerReviewCard: vi.fn(), rateReviewCard: vi.fn() }));
vi.mock("@/app/actions/review", () => ({ answerReviewCard, rateReviewCard }));

import { ReviewSession, type SessionCard } from "@/components/review/ReviewSession";

const previews = { again: "1d", hard: "2d", good: "7d", easy: "21d" };

const quizCard: SessionCard = {
  type: "quiz",
  id: "card-1",
  quizItemId: "m01-q01",
  module: "RAG Foundations",
  previews,
  kind: "single_choice",
  prompt: "Which limitation of a plain language model does RAG address most directly?",
  choices: [
    { id: "a", text: "It generates text too slowly" },
    { id: "b", text: "It can't access knowledge that wasn't in its training data" },
    { id: "c", text: "It can't follow multi-step instructions" },
    { id: "d", text: "It uses too many tokens per answer" },
  ],
};

const failureCard: SessionCard = {
  type: "failure",
  id: "card-2",
  module: "RAG Foundations",
  previews,
  title: "The error code nobody could find",
  user_query: "What does error E4021 mean?",
  retrieved_context: [{ source: "troubleshooting.md#network", text: "Network errors usually indicate a timeout…" }],
  bad_output: "E4021 is a network timeout error.",
  root_cause: "Pure vector search missed the exact code.",
  fix: "Add keyword (BM25) search alongside vector search.",
};

const correct = {
  status: "answered",
  isCorrect: true,
  correctAnswer: { choice: "b" },
  explanation: "RAG supplies relevant text at query time.",
};

beforeEach(() => {
  answerReviewCard.mockReset();
  rateReviewCard.mockReset();
});
afterEach(cleanup);

describe("review card: select an option and reveal the answer", () => {
  it("keeps Check answer disabled until an option is selected", async () => {
    const user = userEvent.setup();
    render(<ReviewSession cards={[quizCard]} remainingAfter={0} />);

    const check = screen.getByRole("button", { name: "Check answer" });
    expect(check).toBeDisabled();

    const option = screen.getByRole("radio", { name: /training data/ });
    await user.click(option);
    expect(option).toBeChecked();
    expect(check).toBeEnabled();
  });

  it("submits the selected option and reveals the result with rating buttons", async () => {
    answerReviewCard.mockResolvedValue(correct);
    const user = userEvent.setup();
    render(<ReviewSession cards={[quizCard]} remainingAfter={0} />);

    expect(screen.queryByRole("button", { name: /^Good/ })).toBeNull();
    await user.click(screen.getByRole("radio", { name: /training data/ }));
    await user.click(screen.getByRole("button", { name: "Check answer" }));

    expect(await screen.findByText("Correct")).toBeInTheDocument();
    expect(screen.getByText("RAG supplies relevant text at query time.")).toBeInTheDocument();
    for (const r of ["Again", "Hard", "Good", "Easy"]) {
      expect(screen.getByRole("button", { name: new RegExp(`^${r}`) })).toBeEnabled();
    }
    // The learner's choice stays visible after the reveal.
    expect(screen.getByRole("radio", { name: /training data/ })).toBeChecked();
    expect(screen.queryByRole("button", { name: "Check answer" })).toBeNull();

    // The client sends exactly what the server action parses.
    const [cardId, fd] = answerReviewCard.mock.calls[0] as [string, FormData];
    expect(cardId).toBe("card-1");
    expect(parseQuizFormData(fd, [{ id: "m01-q01", kind: "single_choice" }])).toEqual({ "m01-q01": { choice: "b" } });
  });

  it("shows the right answer and allows only Again after a miss", async () => {
    answerReviewCard.mockResolvedValue({ ...correct, isCorrect: false });
    const user = userEvent.setup();
    render(<ReviewSession cards={[quizCard]} remainingAfter={0} />);

    await user.click(screen.getByRole("radio", { name: /too slowly/ }));
    await user.click(screen.getByRole("button", { name: "Check answer" }));

    expect(await screen.findByText(/Not quite · Answer: It can't access knowledge/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Again/ })).toBeEnabled();
    for (const r of ["Hard", "Good", "Easy"]) expect(screen.getByRole("button", { name: new RegExp(`^${r}`) })).toBeDisabled();
  });

  it("shows an error instead of failing silently when the server can't be reached", async () => {
    answerReviewCard.mockRejectedValue(new Error("Failed to fetch"));
    const user = userEvent.setup();
    render(<ReviewSession cards={[quizCard]} remainingAfter={0} />);

    await user.click(screen.getByRole("radio", { name: /training data/ }));
    await user.click(screen.getByRole("button", { name: "Check answer" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't reach the server");
    // Still answerable: the learner can retry.
    expect(screen.getByRole("button", { name: "Check answer" })).toBeEnabled();
  });

  it("shows errors returned by the action", async () => {
    answerReviewCard.mockResolvedValue({ status: "error", error: "Card not found." });
    const user = userEvent.setup();
    render(<ReviewSession cards={[quizCard]} remainingAfter={0} />);
    await user.click(screen.getByRole("radio", { name: /training data/ }));
    await user.click(screen.getByRole("button", { name: "Check answer" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Card not found.");
  });

  it("supports multi-choice and short-answer cards", async () => {
    answerReviewCard.mockResolvedValue(correct);
    const user = userEvent.setup();
    const multi: SessionCard = { ...quizCard, id: "card-m", quizItemId: "m01-q02", kind: "multi_choice" };
    const { unmount } = render(<ReviewSession cards={[multi]} remainingAfter={0} />);
    await user.click(screen.getByRole("checkbox", { name: /too slowly/ }));
    await user.click(screen.getByRole("checkbox", { name: /multi-step/ }));
    await user.click(screen.getByRole("checkbox", { name: /too slowly/ })); // untick
    await user.click(screen.getByRole("button", { name: "Check answer" }));
    await screen.findByText("Correct");
    expect(parseQuizFormData(answerReviewCard.mock.calls[0][1], [{ id: "m01-q02", kind: "multi_choice" }])).toEqual({
      "m01-q02": { choices: ["c"] },
    });
    unmount();

    const short: SessionCard = { ...quizCard, id: "card-s", quizItemId: "m01-q03", kind: "short_answer", choices: null };
    render(<ReviewSession cards={[short]} remainingAfter={0} />);
    expect(screen.getByRole("button", { name: "Check answer" })).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: "Your answer" }), "cosine");
    await user.click(screen.getByRole("button", { name: "Check answer" }));
    await screen.findByText("Correct");
    expect(parseQuizFormData(answerReviewCard.mock.calls[1][1], [{ id: "m01-q03", kind: "short_answer" }])).toEqual({
      "m01-q03": { text: "cosine" },
    });
  });

  it("rates the card and moves to the next one, then finishes the session", async () => {
    answerReviewCard.mockResolvedValue(correct);
    rateReviewCard.mockResolvedValue({ status: "rated", rating: "good", intervalDays: 7, dueAt: "2026-10-21T00:00:00Z" });
    const user = userEvent.setup();
    render(<ReviewSession cards={[quizCard, failureCard]} remainingAfter={3} />);

    expect(screen.getByText("Card 1 of 2")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /training data/ }));
    await user.click(screen.getByRole("button", { name: "Check answer" }));
    await user.click(await screen.findByRole("button", { name: /^Good/ }));
    expect(rateReviewCard).toHaveBeenCalledWith("card-1", "good");

    // Failure-case card: reveal, then self-rate.
    expect(await screen.findByText("Card 2 of 2")).toBeInTheDocument();
    expect(screen.queryByText(failureCard.root_cause)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Show answer" }));
    expect(screen.getByText(failureCard.root_cause)).toBeInTheDocument();
    rateReviewCard.mockResolvedValue({ status: "rated", rating: "easy", intervalDays: 21, dueAt: "2026-11-04T00:00:00Z" });
    await user.click(screen.getByRole("button", { name: /^Easy/ }));

    expect(await screen.findByText(/Session complete: 2 cards reviewed/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review 2 more" })).toHaveAttribute("href", "/review");
  });

  it("surfaces rating failures", async () => {
    answerReviewCard.mockResolvedValue(correct);
    rateReviewCard.mockRejectedValue(new Error("Failed to fetch"));
    const user = userEvent.setup();
    render(<ReviewSession cards={[quizCard]} remainingAfter={0} />);
    await user.click(screen.getByRole("radio", { name: /training data/ }));
    await user.click(screen.getByRole("button", { name: "Check answer" }));
    await user.click(await screen.findByRole("button", { name: /^Good/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't reach the server");
    expect(screen.getByText("Card 1 of 1")).toBeInTheDocument();
  });
});
