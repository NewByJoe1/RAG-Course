// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { completeSetup } = vi.hoisted(() => ({ completeSetup: vi.fn() }));
vi.mock("@/app/actions/setup", () => ({ completeSetup }));

import { Markdown } from "@/components/lesson/Markdown";
import { SystemPicker } from "@/components/lesson/System";
import { SetupCheck } from "@/components/lesson/SetupCheck";

let store: Map<string, string>;
beforeEach(() => {
  store = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  completeSetup.mockReset();
});
afterEach(cleanup);

const SPLIT = ":::step Open the terminal\n:::mac\n**Do:** press Cmd+Space.\n:::\n:::windows\n**Do:** open PowerShell.\n:::\n:::linux\n**Do:** press Ctrl+Alt+T.\n:::\n:::";
const visibleSystems = () => Array.from(document.querySelectorAll("[data-os]")).map((e) => e.getAttribute("data-os"));

describe("system picker", () => {
  it("guesses the computer until the learner picks, then shows only that system's steps", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
    render(
      <>
        <SystemPicker />
        <Markdown text={SPLIT} />
      </>,
    );
    expect(screen.getByRole("radio", { name: "Windows" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText(/We guessed Windows/)).toBeInTheDocument();
    expect(visibleSystems()).toEqual(["windows"]);

    await userEvent.setup().click(screen.getByRole("radio", { name: "Mac" }));
    expect(visibleSystems()).toEqual(["mac"]);
    expect(screen.getByText(/Showing the steps for Mac/)).toBeInTheDocument();
    expect(store.get("course-system")).toBe("mac");
  });

  it("remembers the choice on the next visit", () => {
    store.set("course-system", "linux");
    render(<Markdown text={SPLIT} />);
    expect(visibleSystems()).toEqual(["linux"]);
  });

  it("shows every system, labelled, when it can't tell", () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("SomethingElse/1.0");
    render(<Markdown text={SPLIT} />);
    expect(visibleSystems()).toEqual(["mac", "windows", "linux"]);
    expect(screen.getByText("If you're on Linux")).toBeInTheDocument();
  });
});

describe("step cards and code boxes", () => {
  it("numbers steps in order and labels what each code box is for", () => {
    render(<Markdown text={":::step First\n**Do:** a\n:::\n\n:::step Second\n~~~bash\ngit status\n~~~\n~~~prompt\nHello Claude\n~~~\n:::"} />);
    expect(screen.getByRole("region", { name: "Step 1: First" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Step 2: Second" })).toBeInTheDocument();
    expect(screen.getByText("Type this in your terminal")).toBeInTheDocument();
    expect(screen.getByText("Paste this into Claude Code")).toBeInTheDocument();
  });

  it("copies exactly the box's text", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<Markdown text={"~~~bash\ngit add -A\ngit commit -m \"x\"\n~~~"} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: /^Copy/ })));
    expect(writeText).toHaveBeenCalledWith('git add -A\ngit commit -m "x"');
    expect(screen.getByRole("button", { name: "Copied" })).toHaveTextContent("Copied ✓");
  });

  it("tints \"You should see\" and \"If it didn't work\" so they stand out", () => {
    render(<Markdown text={":::step S\n**You should see:** ok\n\n**If it didn't work:** fix\n:::"} />);
    expect(screen.getByText("ok").closest("p")).toHaveClass("bg-emerald-50");
    expect(screen.getByText("fix").closest("p")).toHaveClass("bg-amber-50");
  });
});

describe("Check your setup", () => {
  const checks = ["Open your terminal", "Install Claude Code"];

  it("only unlocks Module 1 once \"My setup works\" is ticked", async () => {
    completeSetup.mockResolvedValue({ status: "done", at: "2026-10-16T10:00:00Z" });
    const user = userEvent.setup();
    render(<SetupCheck checks={checks} doneAt={null} nextHref="/modules/rag-foundations" />);
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual(["1Open your terminal", "2Install Claude Code"]);
    const button = screen.getByRole("button", { name: "Unlock Module 1" });
    expect(button).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: "My setup works" }));
    await user.click(button);
    expect(completeSetup).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("status")).toHaveTextContent("Module 1 is unlocked");
    expect(screen.getByRole("link", { name: "Start Module 1 →" })).toHaveAttribute("href", "/modules/rag-foundations");
  });

  it("shows it's done on a later visit, and surfaces errors", async () => {
    render(<SetupCheck checks={checks} doneAt="2026-10-16T10:00:00Z" nextHref="/x" />);
    expect(screen.getByRole("status")).toHaveTextContent("Your workshop is set up");
    cleanup();
    completeSetup.mockResolvedValue({ status: "error", error: "Your session has expired. Log in again." });
    const user = userEvent.setup();
    render(<SetupCheck checks={checks} doneAt={null} nextHref="/x" />);
    await user.click(screen.getByRole("checkbox", { name: "My setup works" }));
    await user.click(screen.getByRole("button", { name: "Unlock Module 1" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Log in again");
  });
});
