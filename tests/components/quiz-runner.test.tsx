// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { parseQuizFormData } from "@/lib/course/quiz";

const { submitQuiz } = vi.hoisted(() => ({ submitQuiz: vi.fn() }));
vi.mock("@/app/actions/quiz", () => ({ submitQuiz }));

import { clampPosition, QuizRunner, type QuizRunnerItem } from "@/components/quiz/QuizRunner";

const items: QuizRunnerItem[] = [
  { id: "m01-q01", kind: "single_choice", prompt: "First question?", choices: [{ id: "a", text: "Alpha" }, { id: "b", text: "Bravo" }] },
  { id: "m01-q02", kind: "multi_choice", prompt: "Second question?", choices: [{ id: "a", text: "Apple" }, { id: "b", text: "Banana" }, { id: "c", text: "Cherry" }] },
  { id: "m01-q03", kind: "short_answer", prompt: "Third question?", choices: null },
];

const renderRunner = (initialPosition?: string) =>
  render(<QuizRunner moduleId="m01" slug="rag-foundations" moduleTitle="RAG Foundations" items={items} initialPosition={initialPosition} />);
const heading = () => screen.getByRole("heading", { level: 2 });
const next = () => screen.getByRole("button", { name: /Next →|Review answers/ });
const qParam = () => new URL(window.location.href).searchParams.get("q");

async function answerAll(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("radio", { name: "Bravo" }));
  await user.click(next());
  await user.click(screen.getByRole("checkbox", { name: "Apple" }));
  await user.click(screen.getByRole("checkbox", { name: "Cherry" }));
  await user.click(next());
  await user.type(screen.getByRole("textbox", { name: "Your answer" }), "  cosine  ");
  await user.click(next());
}

beforeEach(() => {
  submitQuiz.mockReset();
  window.sessionStorage.clear();
  window.history.replaceState(null, "", "/modules/rag-foundations/quiz");
});
afterEach(cleanup);

describe("QuizRunner: one question per page", () => {
  it("shows one question at a time, and Next needs an answer (with the reason shown)", async () => {
    const user = userEvent.setup();
    renderRunner();
    expect(await screen.findByText("RAG Foundations · Question 1 of 3")).toBeInTheDocument();
    expect(heading()).toHaveTextContent("First question?");
    expect(screen.queryByText("Second question?")).toBeNull();
    expect(next()).toBeDisabled();
    expect(screen.getByText("Answer this question to continue.")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Alpha" }));
    expect(next()).toBeEnabled();
    await user.click(next());
    expect(heading()).toHaveTextContent("Second question?");
    expect(qParam()).toBe("2");
  });

  it("lets the learner go back to revise, keeping every answer", async () => {
    const user = userEvent.setup();
    renderRunner();
    await user.click(await screen.findByRole("radio", { name: "Bravo" }));
    await user.click(next());
    await user.click(screen.getByRole("checkbox", { name: "Banana" }));
    await user.click(screen.getByRole("button", { name: "← Back" }));
    expect(heading()).toHaveTextContent("First question?");
    expect(screen.getByRole("radio", { name: "Bravo" })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "Alpha" })); // revise
    await user.click(next());
    expect(screen.getByRole("checkbox", { name: "Banana" })).toBeChecked();
    expect(screen.getByRole("button", { name: "← Back" })).toBeEnabled();
  });

  it("can't skip ahead through the URL", async () => {
    renderRunner("3");
    expect(await screen.findByText("RAG Foundations · Question 1 of 3")).toBeInTheDocument();
    expect(qParam()).toBe("1");
    cleanup();
    renderRunner("review");
    expect(await screen.findByText("RAG Foundations · Question 1 of 3")).toBeInTheDocument();
  });

  it("clampPosition allows answered questions and the next one, nothing further", () => {
    const answered = { "m01-q01": { selected: ["a"], text: "" } };
    expect(clampPosition("1", items, answered)).toBe(0);
    expect(clampPosition("2", items, answered)).toBe(1);
    expect(clampPosition("3", items, answered)).toBe(1);
    expect(clampPosition("review", items, answered)).toBe(1);
    expect(clampPosition("nonsense", items, answered)).toBe(0);
    const all = { ...answered, "m01-q02": { selected: ["a"], text: "" }, "m01-q03": { selected: [], text: "x" } };
    expect(clampPosition("review", items, all)).toBe("review");
    expect(clampPosition("99", items, all)).toBe(2);
  });

  it("keeps answers across a reload in the same tab", async () => {
    const user = userEvent.setup();
    renderRunner();
    await user.click(await screen.findByRole("radio", { name: "Bravo" }));
    await user.click(next());
    cleanup();
    renderRunner("2");
    expect(await screen.findByText("RAG Foundations · Question 2 of 3")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "← Back" }));
    expect(screen.getByRole("radio", { name: "Bravo" })).toBeChecked();
  });
});

describe("QuizRunner: review and submit (gate unchanged)", () => {
  it("reviews every answer, allows changes, then submits the same form fields as before", async () => {
    submitQuiz.mockResolvedValue({
      status: "graded",
      result: {
        module_id: "m01",
        correct: 3,
        total: 3,
        score: 1,
        threshold: 0.8,
        passed: true,
        best_score: 1,
        passed_at: "2026-10-15T00:00:00Z",
        results: items.map((it) => ({ quiz_item_id: it.id, answered: true, is_correct: true, correct_answer: {}, explanation: `Why ${it.id}` })),
      },
    });
    const user = userEvent.setup();
    renderRunner();
    await answerAll(user);

    expect(heading()).toHaveTextContent("Check your answers");
    expect(qParam()).toBe("review");
    expect(screen.getByText("Your answer: Apple; Cherry")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Change answer to question 1" }));
    await user.click(screen.getByRole("radio", { name: "Alpha" }));
    await user.click(next()); // q2
    await user.click(next()); // q3
    await user.click(next()); // review
    await user.click(screen.getByRole("button", { name: "Submit answers" }));

    const [moduleId, slug, prev, fd] = submitQuiz.mock.calls[0];
    expect([moduleId, slug, prev]).toEqual(["m01", "rag-foundations", { status: "idle" }]);
    // Exactly what submit_module_quiz received from the old one-page form.
    expect(parseQuizFormData(fd, items)).toEqual({
      "m01-q01": { choice: "a" },
      "m01-q02": { choices: ["a", "c"] },
      "m01-q03": { text: "cosine" },
    });

    expect(await screen.findByRole("heading", { name: "Passed: 3/3 (100%)" })).toBeInTheDocument();
    expect(screen.getByText("The next module is unlocked.")).toBeInTheDocument();
    expect(screen.getByText("Why m01-q02")).toBeInTheDocument();
    expect(window.sessionStorage.getItem("quiz-answers:m01")).toBeNull();
  });

  it("shows a failed attempt with the right answers and lets the learner retake", async () => {
    submitQuiz.mockResolvedValue({
      status: "graded",
      result: {
        module_id: "m01",
        correct: 1,
        total: 3,
        score: 1 / 3,
        threshold: 0.8,
        passed: false,
        best_score: 1 / 3,
        passed_at: null,
        results: [
          { quiz_item_id: "m01-q01", answered: true, is_correct: true, correct_answer: { choice: "b" }, explanation: "" },
          { quiz_item_id: "m01-q02", answered: true, is_correct: false, correct_answer: { choices: ["b"] }, explanation: "Banana only." },
          { quiz_item_id: "m01-q03", answered: true, is_correct: false, correct_answer: { accepted: ["cosine similarity"] }, explanation: "" },
        ],
      },
    });
    const user = userEvent.setup();
    renderRunner();
    await answerAll(user);
    await user.click(screen.getByRole("button", { name: "Submit answers" }));
    expect(await screen.findByRole("heading", { name: "Not passed yet: 1/3 (33%)" })).toBeInTheDocument();
    expect(screen.getByText(/You need 80% to pass/)).toBeInTheDocument();
    expect(screen.getByText(/Incorrect · Answer: Banana/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retake quiz" }));
    expect(heading()).toHaveTextContent("First question?");
    expect(screen.getByRole("radio", { name: "Bravo" })).not.toBeChecked();
  });

  it("keeps the answers when submitting fails", async () => {
    submitQuiz.mockRejectedValue(new Error("Failed to fetch"));
    const user = userEvent.setup();
    renderRunner();
    await answerAll(user);
    await user.click(screen.getByRole("button", { name: "Submit answers" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Your answers are kept");
    expect(window.sessionStorage.getItem("quiz-answers:m01")).toContain("cosine");
  });
});
