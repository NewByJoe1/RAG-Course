import { Fragment, type ReactNode } from "react";
import { findTerms, parseInline, parseMarkdown, termForCode, type Inline, type MdBlock } from "@/lib/course/markdown";
import { Term } from "./Term";
import { CodeBlock } from "./CodeBlock";
import { OsBlock } from "./System";
import { VideoMarker } from "./VideoMarker";

/**
 * Lesson text renderer (see lib/course/markdown.ts for the dialect). The
 * first time each glossary term appears in a block of text it gets a
 * tooltip; later mentions stay plain so the page stays calm.
 */
export function Markdown({
  text,
  size = "base",
  inline = false,
  terms = true,
  seen,
}: {
  text: string;
  size?: "base" | "sm";
  /** Render inline content only (no paragraphs), e.g. inside a sentence. */
  inline?: boolean;
  /** Link glossary terms (on by default). */
  terms?: boolean;
  /** Share with sibling blocks so a term is only underlined once across them. */
  seen?: Set<string>;
}) {
  const ctx: Ctx = { seen: terms ? (seen ?? new Set()) : null, key: 0, step: 0 };
  if (inline) return <>{renderInline(parseInline(text), ctx)}</>;
  const sizing = size === "sm" ? "space-y-3 text-sm leading-relaxed" : "space-y-5 text-[1.0625rem] leading-8";
  return <div className={`${sizing} text-neutral-700 dark:text-neutral-300`}>{renderBlocks(parseMarkdown(text), ctx, size)}</div>;
}

type Ctx = { seen: Set<string> | null; key: number; step: number };

// Step cards label their parts in bold; the last two get a tint so the eye
// finds "did it work?" and "what if it didn't?" quickly.
const LABEL_STYLE: [RegExp, string][] = [
  [/^\*\*You should see:\*\*/, "rounded-lg bg-emerald-50 px-3 py-2 dark:bg-emerald-950/40"],
  [/^\*\*If it didn't work:\*\*/, "rounded-lg bg-amber-50 px-3 py-2 dark:bg-amber-950/40"],
];

function renderBlocks(blocks: MdBlock[], ctx: Ctx, size: "base" | "sm"): ReactNode[] {
  return blocks.map((b) => {
    const k = ctx.key++;
    switch (b.type) {
      case "p": {
        const tint = LABEL_STYLE.find(([re]) => re.test(b.text))?.[1];
        return (
          <p key={k} className={tint}>
            {renderInline(parseInline(b.text), ctx)}
          </p>
        );
      }
      case "code":
        return <CodeBlock key={k} lang={b.lang} text={b.text} />;
      case "video":
        return <VideoMarker key={k} id={b.id} />;
      case "os":
        return (
          <OsBlock key={k} os={b.os}>
            {renderBlocks(b.blocks, ctx, size)}
          </OsBlock>
        );
      case "step": {
        const n = ++ctx.step;
        return (
          <section key={k} aria-label={`Step ${n}: ${b.title}`} className="space-y-4 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
            <h3 className="flex items-start gap-3 text-lg font-semibold tracking-tight text-neutral-900 dark:text-white">
              <span aria-hidden className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-700 text-sm text-white dark:bg-teal-400 dark:text-neutral-950">
                {n}
              </span>
              <span>
                <span className="sr-only">Step {n}: </span>
                {b.title}
              </span>
            </h3>
            <div className="space-y-4">{renderBlocks(b.blocks, ctx, size)}</div>
          </section>
        );
      }
      case "h":
        return (
          <h4 key={k} className={`${size === "sm" ? "pt-1" : "pt-3"} font-semibold tracking-tight text-neutral-900 dark:text-white`}>
            {renderInline(parseInline(b.text), ctx)}
          </h4>
        );
      case "list": {
        const List = b.ordered ? "ol" : "ul";
        return (
          <List key={k} className={`${b.ordered ? "list-decimal" : "list-disc"} space-y-2 pl-6 marker:text-neutral-400 dark:marker:text-neutral-500`}>
            {b.items.map((it, i) => (
              <li key={i} className="pl-1">
                {renderInline(parseInline(it.text), ctx)}
                {it.children.length > 0 && <div className="mt-2 space-y-2">{renderBlocks(it.children, ctx, size)}</div>}
              </li>
            ))}
          </List>
        );
      }
      case "quote":
        return (
          <blockquote key={k} className="space-y-2 rounded-r-lg border-l-4 border-neutral-300 bg-neutral-50 px-4 py-3 italic dark:border-neutral-600 dark:bg-neutral-900">
            {renderBlocks(b.blocks, ctx, size)}
          </blockquote>
        );
      case "key":
        return (
          <aside key={k} aria-label={b.title ?? "Key idea"} className="space-y-3 rounded-2xl border-l-4 border-teal-700 bg-teal-50/70 px-5 py-4 dark:border-teal-400 dark:bg-teal-950/40">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-800 dark:text-teal-300">{b.title ?? "Key idea"}</p>
            {renderBlocks(b.blocks, ctx, size)}
          </aside>
        );
      case "more":
        return (
          <details key={k} className="group rounded-xl border border-neutral-200 px-4 py-3 dark:border-neutral-800">
            <summary className="cursor-pointer list-none text-sm font-medium text-neutral-900 marker:hidden dark:text-white [&::-webkit-details-marker]:hidden">
              <span aria-hidden className="mr-2 inline-block text-neutral-400 transition-transform group-open:rotate-90">
                ›
              </span>
              Show more: {b.title}
            </summary>
            <div className="mt-3 space-y-3">{renderBlocks(b.blocks, ctx, size)}</div>
          </details>
        );
    }
  });
}

function renderInline(nodes: Inline[], ctx: Ctx): ReactNode[] {
  return nodes.map((n) => {
    const k = ctx.key++;
    switch (n.type) {
      case "br":
        return <br key={k} />;
      case "code": {
        const code = (
          <code key={k} className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[0.875em] text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100">
            {n.text}
          </code>
        );
        const id = ctx.seen ? termForCode(n.text) : null;
        if (!id || ctx.seen!.has(id)) return code;
        ctx.seen!.add(id);
        return (
          <Term key={k} id={id}>
            {code}
          </Term>
        );
      }
      case "bold":
        return (
          <strong key={k} className="font-semibold text-neutral-900 dark:text-white">
            {renderInline(n.children, ctx)}
          </strong>
        );
      case "text":
        return <Fragment key={k}>{linkTerms(n.text, ctx)}</Fragment>;
    }
  });
}

function linkTerms(text: string, ctx: Ctx): ReactNode {
  if (!ctx.seen) return text;
  const parts: ReactNode[] = [];
  let last = 0;
  for (const t of findTerms(text)) {
    if (ctx.seen.has(t.id)) continue;
    ctx.seen.add(t.id);
    if (t.start > last) parts.push(text.slice(last, t.start));
    parts.push(
      <Term key={ctx.key++} id={t.id}>
        {text.slice(t.start, t.end)}
      </Term>,
    );
    last = t.end;
  }
  if (!parts.length) return text;
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
