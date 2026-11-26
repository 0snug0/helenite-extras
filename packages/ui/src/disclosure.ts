import { card } from "./card";
import type { CardHandle, CardOptions } from "./card";
import { make } from "./states";

export interface DisclosureOptions extends Omit<CardOptions, "title"> {
  title: string;
  /** Starts open. Default closed. */
  open?: boolean;
  /** One line shown in the head while closed, such as the answer given. */
  summary?: string;
  /**
   * Called when the head is clicked (or Enter or Space is pressed on it) with the state asked for. With it, nothing
   * changes until you call `setOpen`; without it, the head opens and closes the card itself.
   */
  onToggle?: (open: boolean) => void;
}

export interface DisclosureHandle extends CardHandle {
  titleEl: HTMLElement;
  /** Before the title in the head, for a badge or a chip. Not shown while empty. */
  lead: HTMLElement;
  /** The head's one-line summary (`hel-disclosure-summary`). Not shown while open or empty. */
  summaryEl: HTMLElement;
  /** Content under the head that stays on show while the card is closed. Not shown while empty. */
  peek: HTMLElement;
  /** Shows or hides the body and the footer. Does not call `onToggle`. */
  setOpen(open: boolean): void;
  setSummary(text: string): void;
}

/** What handles its own click, so it does not open the card it sits in the head of. */
const CONTROL = 'a, button, input, select, textarea, label, [role="button"]';

let bodies = 0;

/** A card whose head opens and closes its body: one step of an accordion. */
export function disclosure(parent: HTMLElement, o: DisclosureOptions): DisclosureHandle {
  const c = card(parent, o);
  const { el, head, body, footer } = c;
  const titleEl = c.titleEl!;
  el.classList.add("hel-disclosure");
  const lead = make(head, "div", ["hel-disclosure-lead"]);
  const heading = make(head, "div", ["hel-disclosure-heading"]);
  heading.appendChild(titleEl);
  const summaryEl = make(heading, "div", ["hel-disclosure-summary"], o.summary ?? "");
  const peek = make(el, "div", ["hel-disclosure-peek"]);
  el.insertBefore(peek, body);
  body.id = `hel-disclosure-${++bodies}`;
  head.setAttribute("role", "button");
  head.setAttribute("aria-controls", body.id);
  head.tabIndex = 0;
  const setOpen = (open: boolean): void => {
    el.classList.toggle("is-open", open);
    head.setAttribute("aria-expanded", String(open));
    body.hidden = !open;
    footer.hidden = !open;
  };
  setOpen(o.open ?? false);
  const ask = (): void => {
    const next = !el.classList.contains("is-open");
    if (o.onToggle) o.onToggle(next);
    else setOpen(next);
  };
  head.addEventListener("click", (e) => {
    const control = (e.target as Element).closest(CONTROL);
    if (control && control !== head && head.contains(control)) return;
    ask();
  });
  head.addEventListener("keydown", (e) => {
    if (e.target !== head || (e.key !== "Enter" && e.key !== " ")) return;
    e.preventDefault();
    ask();
  });
  return { ...c, titleEl, lead, summaryEl, peek, setOpen, setSummary: (text) => { summaryEl.textContent = text; } };
}
