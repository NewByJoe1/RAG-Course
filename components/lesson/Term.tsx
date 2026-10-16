"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { GLOSSARY_BY_ID } from "@/content/glossary";

/**
 * A glossary term in running text: subtly underlined, with a small popover
 * giving the full term and a one-line definition from content/glossary.ts.
 * Mouse hover previews it; tap, click, Enter or Space pins it; Escape, a
 * second tap or a tap elsewhere closes it.
 */
export function Term({ id, children }: { id: string; children: React.ReactNode }) {
  const g = GLOSSARY_BY_ID[id];
  const popId = `${useId()}-term`;
  const [open, setOpen] = useState<null | "hover" | "pinned">(null);
  const [shift, setShift] = useState(0);
  const wrap = useRef<HTMLSpanElement>(null);
  const card = useRef<HTMLSpanElement>(null);

  // Keep the popover on screen near the right edge (phones especially).
  useLayoutEffect(() => {
    if (!open || !card.current) return setShift(0);
    const r = card.current.getBoundingClientRect();
    const max = window.innerWidth - 12;
    setShift(r.right > max ? Math.max(12 - r.left, max - r.right) : 0);
  }, [open]);

  useEffect(() => {
    if (open !== "pinned") return;
    const away = (e: PointerEvent) => wrap.current && !wrap.current.contains(e.target as Node) && setOpen(null);
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  if (!g) return <>{children}</>;
  const toggle = () => setOpen((o) => (o === "pinned" ? null : "pinned"));

  return (
    <span
      ref={wrap}
      className="relative"
      onPointerEnter={(e) => e.pointerType === "mouse" && setOpen((o) => o ?? "hover")}
      onPointerLeave={(e) => e.pointerType === "mouse" && setOpen((o) => (o === "hover" ? null : o))}
    >
      <span
        role="button"
        tabIndex={0}
        aria-expanded={open !== null}
        aria-describedby={open ? popId : undefined}
        data-term={g.id}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
          } else if (e.key === "Escape" && open) {
            e.stopPropagation(); // close just this popover, not the panel it sits in
            setOpen(null);
          }
        }}
        onBlur={(e) => !wrap.current?.contains(e.relatedTarget as Node) && setOpen((o) => (o === "pinned" ? null : o))}
        className="cursor-help rounded-sm underline decoration-neutral-400 decoration-dotted decoration-1 underline-offset-[5px] hover:decoration-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:decoration-neutral-500 dark:hover:decoration-teal-400 dark:focus-visible:ring-teal-400"
      >
        {children}
      </span>
      {open && (
        <span className="absolute left-0 top-full z-30 block pt-2" style={shift ? { transform: `translateX(${shift}px)` } : undefined}>
          <span
            ref={card}
            id={popId}
            role="tooltip"
            className="block w-72 max-w-[calc(100vw-1.5rem)] rounded-xl border border-neutral-200 bg-white p-3 text-left font-sans text-sm font-normal not-italic leading-relaxed text-neutral-700 shadow-lg dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
          >
            <span className="block font-semibold text-neutral-900 dark:text-white">{g.term}</span>
            <span className="mt-1 block">{g.definition}</span>
            <a href={`/glossary#term-${g.id}`} className="mt-2 inline-block text-xs font-medium text-teal-700 underline underline-offset-2 dark:text-teal-400">
              Open the glossary
            </a>
          </span>
        </span>
      )}
    </span>
  );
}
