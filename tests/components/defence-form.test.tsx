// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { recordDefence } = vi.hoisted(() => ({ recordDefence: vi.fn() }));
vi.mock("@/app/actions/defence", () => ({ recordDefence }));

import { DefenceForm } from "@/components/reviewer/DefenceForm";

const LEARNER = "11111111-1111-4111-8111-111111111111";

async function fillAll(user: ReturnType<typeof userEvent.setup>, opts: { failQ?: number; unverifiedQ?: number; closing?: "Pass" | "Fail" } = {}) {
  for (let i = 1; i <= 6; i++) {
    await user.type(screen.getByRole("textbox", { name: `Question ${i}` }), `Asked ${i}`);
    if (opts.unverifiedQ !== i) await user.click(screen.getByRole("checkbox", { name: `Question ${i}: answer had a verified citation` }));
    await user.click(screen.getByRole("radio", { name: `Question ${i}: ${opts.failQ === i ? "Fail" : "Pass"}` }));
  }
  await user.click(screen.getByRole("radio", { name: `Closing question: ${opts.closing ?? "Pass"}` }));
}

beforeEach(() => recordDefence.mockReset());
afterEach(cleanup);

describe("DefenceForm", () => {
  it("shows six question slots and the closing question, and can't be saved until complete", async () => {
    const user = userEvent.setup();
    render(<DefenceForm learnerId={LEARNER} learnerName="Ana" />);
    expect(screen.getAllByRole("textbox", { name: /^Question \d$/ })).toHaveLength(6);
    expect(screen.getByText(/What would make this answer wrong, and how would you know\?/)).toBeInTheDocument();
    const save = screen.getByRole("button", { name: "Record defence" });
    expect(save).toBeDisabled();
    await fillAll(user);
    expect(save).toBeEnabled();
  });

  it("previews a pass only when every question passes with a verified citation and the closing question passes", async () => {
    const user = userEvent.setup();
    render(<DefenceForm learnerId={LEARNER} learnerName="Ana" />);
    await fillAll(user);
    expect(screen.getByRole("status")).toHaveTextContent("Defence criterion will be met.");
  });

  it.each([
    [{ failQ: 3 }, "Question 3 failed"],
    [{ unverifiedQ: 5 }, "Question 5 had no verified citation"],
    [{ closing: "Fail" as const }, "Closing question failed"],
  ])("previews not met for %j", async (opts, reason) => {
    const user = userEvent.setup();
    render(<DefenceForm learnerId={LEARNER} learnerName="Ana" />);
    await fillAll(user, opts);
    expect(screen.getByRole("status")).toHaveTextContent(`won't be met: ${reason}`);
  });

  it("submits the answers and shows the saved result", async () => {
    recordDefence.mockResolvedValue({ status: "saved", passed: true, metCount: 6, allMet: true, recordedAt: "2026-10-15T10:00:00Z" });
    const user = userEvent.setup();
    render(<DefenceForm learnerId={LEARNER} learnerName="Ana" />);
    await fillAll(user);
    await user.type(screen.getByRole("textbox", { name: "Question 2 note" }), "Strong citation");
    await user.click(screen.getByRole("button", { name: "Record defence" }));

    const [learnerId, payload] = recordDefence.mock.calls[0];
    expect(learnerId).toBe(LEARNER);
    expect(payload.questions).toHaveLength(6);
    expect(payload.questions[1]).toEqual({ question: "Asked 2", citation_verified: true, passed: true, note: "Strong citation" });
    expect(payload.closing_passed).toBe(true);
    expect(await screen.findByText(/Saved for Ana: defence passed\. Now 6\/6 on main \(capstone passed; mastery recorded\)\./)).toBeInTheDocument();
    // Ready for the next defence.
    expect(screen.getByRole("textbox", { name: "Question 1" })).toHaveValue("");
  });

  it("shows errors from the server", async () => {
    recordDefence.mockResolvedValue({ status: "error", error: "Only reviewers can record a defence, and never their own." });
    const user = userEvent.setup();
    render(<DefenceForm learnerId={LEARNER} learnerName="Ana" />);
    await fillAll(user);
    await user.click(screen.getByRole("button", { name: "Record defence" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Only reviewers can record a defence");
  });
});
