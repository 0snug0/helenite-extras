import { button, type ButtonOptions } from "./button";
import { make } from "./states";

export type CalloutTone = "info" | "accent" | "warning" | "danger" | "success";

export interface CalloutOptions {
  tone?: CalloutTone;
  text: string | DocumentFragment;
  /** A button after the text (its own options, as for `button`). */
  action?: ButtonOptions;
  /** A filled banner in the tone's colour, with on-accent text and a contrasting action: for something that must not be missed. */
  solid?: boolean;
  /** Announces text changes to screen readers (`aria-live="polite"`), for an error or status line that updates. */
  live?: boolean;
}

export interface CalloutHandle {
  el: HTMLElement;
  setText(t: string): void;
  setTone(t: CalloutTone): void;
  hide(): void;
  show(): void;
}

/** Obsidian's callout type for each tone, so a theme's callout colours apply. */
const CALLOUT_TYPE: Record<CalloutTone, string> = { info: "info", accent: "note", warning: "warning", danger: "danger", success: "success" };

/** A banner or inline message: toned text, optionally with an action button. Also Obsidian's `callout`. */
export function callout(parent: HTMLElement, o: CalloutOptions): CalloutHandle {
  const el = make(parent, "div", ["hel-callout", "callout"]);
  if (o.solid) el.classList.add("is-solid");
  if (o.live) el.setAttribute("aria-live", "polite");
  const text = make(el, "div", ["hel-callout-text"]);
  if (typeof o.text === "string") text.textContent = o.text;
  else text.appendChild(o.text);
  if (o.action) button(el, o.action).el.classList.add("hel-callout-action");
  let tone: CalloutTone = o.tone ?? "info";
  const setTone = (t: CalloutTone): void => {
    el.classList.remove(`is-${tone}`);
    tone = t;
    el.classList.add(`is-${t}`);
    el.dataset.callout = CALLOUT_TYPE[t];
  };
  setTone(tone);
  return {
    el,
    setText(t) {
      text.textContent = t;
    },
    setTone,
    hide() {
      el.hidden = true;
    },
    show() {
      el.hidden = false;
    },
  };
}
