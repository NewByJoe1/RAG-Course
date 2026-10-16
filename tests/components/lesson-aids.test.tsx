// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { saveExplainBack } = vi.hoisted(() => ({ saveExplainBack: vi.fn() }));
vi.mock("@/app/actions/explain-back", () => ({ saveExplainBack }));

import { WorkedExample } from "@/components/lesson/WorkedExample";
import { ExplainBack } from "@/components/lesson/ExplainBack";
import { StudyGuide } from "@/components/lesson/StudyGuide";
import { LessonVideo } from "@/components/lesson/LessonVideo";
import { modules } from "@/content";

const m01 = modules.find((m) => m.id === "m01")!;
beforeEach(() => saveExplainBack.mockReset());
afterEach(cleanup);

describe("WorkedExample", () => {
  const steps = m01.worked_example!.map((w) => ({ code_snippet: null, stage: null, query_state: null, ...w }));

  it("steps through Module 1's example, showing the stage and the question's state", async () => {
    const user = userEvent.setup();
    render(<WorkedExample steps={steps} />);
    expect(screen.getByText(`Step 1 of ${steps.length}`)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "The question arrives" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "← Previous" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Next step →" }));
    await user.click(screen.getByRole("button", { name: "Next step →" }));
    expect(screen.getByRole("heading", { name: "Search the index" })).toBeInTheDocument();
    expect(screen.getByText("[2] hybrid retrieval")).toBeInTheDocument();
    expect(screen.getByText(/§4.2\(b\) is 5th and left out/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Step 6:/ }));
    expect(screen.getByRole("heading", { name: "Diagnose: retrieval or generation?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next step →" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Step 1: .* \(done\)$/ })).toBeInTheDocument();
  });
});

describe("ExplainBack", () => {
  it("saves the learner's explanation privately and shows it back", async () => {
    saveExplainBack.mockResolvedValue({ status: "saved", createdAt: "2026-10-15T12:00:00Z" });
    const user = userEvent.setup();
    render(<ExplainBack moduleId="m01" prompt={m01.explain_back_prompt!} previous={null} />);
    const box = screen.getByRole("textbox", { name: /retrieval mistake or a generation mistake/ });
    await user.type(box, "Retrieval: §4.2(b) never reached the writer.");
    await user.click(screen.getByRole("button", { name: "Save my explanation" }));
    expect(saveExplainBack).toHaveBeenCalledWith("m01", "Retrieval: §4.2(b) never reached the writer.");
    expect(await screen.findByRole("status")).toHaveTextContent("Retrieval: §4.2(b) never reached the writer.");
    expect(box).toHaveValue("");
    expect(screen.getByText(/Only you can see this/)).toBeInTheDocument();
  });

  it("shows the previous explanation and surfaces errors", async () => {
    saveExplainBack.mockResolvedValue({ status: "error", error: "Write your explanation first." });
    const user = userEvent.setup();
    render(<ExplainBack moduleId="m01" prompt="Explain it." previous={{ response: "Earlier answer", created_at: "2026-10-14T12:00:00Z" }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Earlier answer");
    await user.click(screen.getByRole("button", { name: "Save my explanation" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Write your explanation first.");
  });
});

describe("StudyGuide and the video seam", () => {
  it("lists every must-recall point with its narration and links the script export", () => {
    render(<StudyGuide points={m01.study_guide!} scriptHref="/modules/rag-foundations/study-guide" />);
    expect(screen.getAllByRole("listitem")).toHaveLength(m01.study_guide!.length);
    expect(screen.getAllByText("Narration")).toHaveLength(m01.study_guide!.length);
    expect(screen.getByRole("link", { name: /narration script/ })).toHaveAttribute("href", "/modules/rag-foundations/study-guide");
  });

  it("renders no video until a module has one, and a captioned player when it does", () => {
    const { container } = render(<LessonVideo video={null} />);
    expect(container).toBeEmptyDOMElement();
    cleanup();
    render(<LessonVideo video={{ src: "/v/m01.mp4", title: "The question flowing through the pipeline", captions: "/v/m01.vtt" }} />);
    expect(screen.getByRole("region", { name: "The question flowing through the pipeline" })).toBeInTheDocument();
    expect(document.querySelector("track[kind=captions]")).toHaveAttribute("src", "/v/m01.vtt");
  });
});
