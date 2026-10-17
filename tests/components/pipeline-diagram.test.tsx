// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PipelineDiagram } from "@/components/pipeline/PipelineDiagram";
import { PIPELINE } from "@/content/pipeline";

afterEach(cleanup);
const node = (label: RegExp) => screen.getByRole("button", { name: label });
const panel = () => screen.getByRole("region", { name: "Stage details" });

describe("PipelineDiagram", () => {
  it("shows all seven stages with exact labels, and marks you-are-here with text, not colour alone", () => {
    render(<PipelineDiagram current={["hybrid-retrieval", "generation"]} />);
    const labels = within(screen.getByRole("list", { name: "RAG pipeline stages" }))
      .getAllByRole("button")
      .map((b) => b.getAttribute("aria-label"));
    expect(labels).toEqual([
      "[1] pre-retrieval",
      "[1b] routing",
      "[2] hybrid retrieval, you are here",
      "[3] post-retrieval",
      "[4] re-rank",
      "[5] generation, you are here",
      "[6] eval & guardrails",
    ]);
    expect(node(/^\[2\]/)).toHaveAttribute("aria-current", "step");
    expect(node(/^\[2\]/)).toHaveTextContent("You are here");
    expect(node(/^\[3\]/)).not.toHaveAttribute("aria-current");
  });

  it("opens the current stage by default: one-liner, does, why, and how it's done behind a show-more", () => {
    render(<PipelineDiagram current={["hybrid-retrieval"]} />);
    expect(panel()).toHaveTextContent("Stage [2]hybrid retrieval");
    expect(panel()).toHaveTextContent(PIPELINE[2].plain);
    for (const k of ["What it does", "Why it's there", "With the whole pipeline built", "Show more: how it's done"]) expect(panel()).toHaveTextContent(k);
    expect(panel().querySelector("details")).not.toHaveAttribute("open");
    expect(node(/^\[2\]/)).toHaveAttribute("aria-expanded", "true");
  });

  it("gives every stage a plain one-liner and the module that covers it", () => {
    render(<PipelineDiagram current={["hybrid-retrieval", "generation"]} moduleId="m01" />);
    for (const s of PIPELINE) {
      const b = node(new RegExp(`^\\[${s.number}\\]`));
      expect(b).toHaveTextContent(s.plain);
      expect(b).toHaveTextContent(`Covered in Module ${Number(s.coveredIn.slice(1))}`);
    }
    expect(node(/^\[2\]/)).toHaveTextContent("Covered in Module 3");
  });

  it("marks the stages a later module adds as not built yet (Module 1 builds only [2] and [5])", () => {
    render(<PipelineDiagram current={["hybrid-retrieval", "generation"]} moduleId="m01" />);
    for (const [n, m] of [[/^\[1\]/, 2], [/^\[4\]/, 5], [/^\[6\]/, 7]] as const) {
      expect(node(n)).toHaveTextContent("Not built yet");
      expect(node(n)).toHaveTextContent(`Covered in Module ${m}`);
    }
    for (const n of [/^\[2\]/, /^\[5\]/]) expect(node(n)).not.toHaveTextContent("Not built yet");
    cleanup();
    render(<PipelineDiagram current={["hybrid-retrieval"]} moduleId="m03" />);
    expect(node(/^\[1\]/)).toHaveTextContent("Built in Module 2");
    expect(node(/^\[5\]/)).toHaveTextContent("Built in Module 1");
  });

  it("shows the running example as of the module being read, and the finished pipeline for stages not built yet", () => {
    render(<PipelineDiagram current={["hybrid-retrieval", "generation"]} moduleId="m01" />);
    expect(panel()).toHaveTextContent("The subcontractor question, as of Module 1");
    expect(panel()).toHaveTextContent("§4.2(b) ranks 5th");
    fireEvent.click(node(/^\[4\]/));
    expect(panel()).toHaveTextContent("Once it's built");
    cleanup();
    render(<PipelineDiagram current={["re-rank"]} moduleId="m05" />);
    expect(panel()).toHaveTextContent("§4.5 jumps from 6th to 1st");
    fireEvent.click(node(/^\[5\]/)); // built in Module 1, last changed in Module 5
    expect(panel()).toHaveTextContent("The subcontractor question, as of Module 5");
    expect(panel()).toHaveTextContent("muddled second route");
  });

  it("previews a stage on mouse hover and returns to the pinned one on leave", async () => {
    const user = userEvent.setup();
    render(<PipelineDiagram current={["hybrid-retrieval"]} />);
    await user.hover(node(/^\[4\]/));
    expect(panel()).toHaveTextContent("Stage [4]re-rank");
    await user.unhover(node(/^\[4\]/));
    expect(panel()).toHaveTextContent("Stage [2]hybrid retrieval");
  });

  it("expands on tap (touch) without needing hover, and a second tap closes it", () => {
    render(<PipelineDiagram current={[]} />);
    expect(panel()).toHaveTextContent("Choose a stage");
    const routing = node(/^\[1b\]/);
    fireEvent.pointerEnter(routing, { pointerType: "touch" }); // touch never previews
    expect(panel()).toHaveTextContent("Choose a stage");
    fireEvent.click(routing);
    expect(panel()).toHaveTextContent("Stage [1b]routing");
    expect(routing).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(routing);
    expect(panel()).toHaveTextContent("Choose a stage");
  });

  it("works from the keyboard: Tab to a stage, Enter to open, Escape to close", async () => {
    const user = userEvent.setup();
    render(<PipelineDiagram current={[]} />);
    await user.tab();
    expect(node(/^\[1\]/)).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(panel()).toHaveTextContent("Stage [1]pre-retrieval");
    await user.tab();
    await user.keyboard(" ");
    expect(panel()).toHaveTextContent("Stage [1b]routing");
    await user.keyboard("{Escape}");
    expect(panel()).toHaveTextContent("Choose a stage");
  });
});
