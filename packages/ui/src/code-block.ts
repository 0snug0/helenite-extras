import { make } from "./states";

export interface CodeBlockOptions {
  /** The box's accessible name. Default "Code". */
  label?: string;
}

/** Source code as written: monospace, selectable, never wrapped (a long line scrolls sideways). Change it with `textContent`. */
export function codeBlock(parent: HTMLElement, code: string, o: CodeBlockOptions = {}): HTMLPreElement {
  const el = make(parent, "pre", ["hel-code-block"], code) as HTMLPreElement;
  el.tabIndex = 0; // a keyboard scrolls a long line too
  el.setAttribute("role", "group");
  el.setAttribute("aria-label", o.label ?? "Code");
  return el;
}
