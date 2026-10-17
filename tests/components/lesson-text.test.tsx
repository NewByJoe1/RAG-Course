// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Markdown } from "@/components/lesson/Markdown";
import { HandsOn } from "@/components/lesson/HandsOn";
import { parseHandsOn } from "@/lib/course/hands-on";
import { GLOSSARY_BY_ID } from "@/content/glossary";
import { modules } from "@/content";

afterEach(cleanup);

describe("Markdown", () => {
  it("renders bold, lists, key ideas and show-more boxes with no raw markdown left", () => {
    const { container } = render(
      <Markdown text={"**Retrieve** the clauses.\n\n- **Load** the PDF\n- Chunk it\n\n:::key Two jobs\nThe librarian.\n:::\n\n:::more How it's done\nHidden detail.\n:::"} />,
    );
    expect(container.textContent).not.toMatch(/\*\*|:::/);
    expect(container.querySelector("strong")).toHaveTextContent("Retrieve");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("complementary", { name: "Two jobs" })).toHaveTextContent("The librarian.");
    expect(container.querySelector("details")).not.toHaveAttribute("open");
    expect(screen.getByText("Show more: How it's done", { exact: false })).toBeInTheDocument();
  });

  it("underlines only the first mention of a term in a block", () => {
    render(<Markdown text="The NDA is short. The NDA is mutual." />);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "NDA" })).toHaveAttribute("data-term", "nda");
  });

  it("can render without tooltips", () => {
    render(<Markdown text="The NDA" terms={false} />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("Term tooltips", () => {
  const nda = GLOSSARY_BY_ID.nda;

  it("shows the full term and a one-line definition on mouse hover", async () => {
    const user = userEvent.setup();
    render(<Markdown text="Read the NDA." />);
    await user.hover(screen.getByRole("button", { name: "NDA" }));
    const tip = screen.getByRole("tooltip");
    expect(tip).toHaveTextContent(nda.term);
    expect(tip).toHaveTextContent(nda.definition);
    expect(screen.getByRole("button", { name: "NDA" })).toHaveAccessibleDescription(new RegExp("non-disclosure agreement"));
    await user.unhover(screen.getByRole("button", { name: "NDA" }));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("opens on tap without hover, and closes on a second tap or a tap elsewhere", () => {
    render(<Markdown text="Read the NDA." />);
    const term = screen.getByRole("button", { name: "NDA" });
    fireEvent.pointerEnter(term, { pointerType: "touch" });
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.click(term);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    fireEvent.click(term);
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.click(term);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("works from the keyboard: Tab, Enter to open, Escape to close", async () => {
    const user = userEvent.setup();
    render(<Markdown text="Read the NDA." />);
    await user.tab();
    expect(screen.getByRole("button", { name: "NDA" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});

describe("HandsOn", () => {
  const m01 = modules.find((m) => m.id === "m01")!;
  const plan = parseHandsOn(m01.lesson_steps.find((s) => s.kind === "exercise")!.body_md)!;

  it("reveals the tiers one at a time: guided, then partial, then solo", async () => {
    const user = userEvent.setup();
    render(<HandsOn plan={plan} />);
    const tiers = () => within(screen.getByRole("list", { name: "Try it yourself" })).getAllByRole("heading", { level: 2 });
    expect(tiers().map((h) => h.textContent)).toEqual(["Start here"]);
    await user.click(screen.getByRole("button", { name: "Done? Show the next step →" }));
    expect(tiers().map((h) => h.textContent)).toEqual(["Start here", "Now with less help"]);
    expect(tiers()[1]).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Done? Show the next step →" }));
    expect(tiers().map((h) => h.textContent)).toEqual(["Start here", "Now with less help", "On your own"]);
    expect(screen.queryByRole("button", { name: /Show the next step/ })).toBeNull();
  });

  it("keeps the project plumbing behind a show-more, with no internal labels in view", () => {
    const { container } = render(<HandsOn plan={plan} />);
    expect(container.textContent).not.toMatch(/Capstone branch|Check it with your assistant|Files you create/);
    expect(container.querySelector("details")).not.toHaveAttribute("open");
    expect(screen.getByText(/saving your work in the course project/)).toBeInTheDocument();
  });
});
