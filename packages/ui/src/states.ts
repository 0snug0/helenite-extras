import { button } from "./button";

export type Tone = "default" | "accent" | "danger" | "success";

function make(parent: HTMLElement, tag: string, cls: string[], text?: string): HTMLElement {
  const el = parent.ownerDocument.createElement(tag);
  el.classList.add(...cls);
  if (text !== undefined) el.textContent = text;
  parent.appendChild(el);
  return el;
}

export function emptyState(parent: HTMLElement, text: string): HTMLElement {
  return make(parent, "div", ["hel-empty"], text);
}

export function loadingState(parent: HTMLElement, text = "Loading…"): HTMLElement {
  const el = make(parent, "div", ["hel-loading"], text);
  el.setAttribute("role", "status");
  return el;
}

export function errorState(parent: HTMLElement, text: string, retry?: () => void): HTMLElement {
  const el = make(parent, "div", ["hel-error"]);
  el.setAttribute("role", "alert");
  make(el, "span", ["hel-error-text"], text);
  if (retry) button(el, { text: "Try again", onClick: () => retry() });
  return el;
}

export function badge(parent: HTMLElement, text: string, tone: Tone = "default"): HTMLElement {
  return make(parent, "span", ["hel-badge", `is-${tone}`], text);
}

export function statusDot(parent: HTMLElement, tone: Tone, label: string): HTMLElement {
  const el = make(parent, "span", ["hel-status-dot", `is-${tone}`]);
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", label);
  return el;
}
