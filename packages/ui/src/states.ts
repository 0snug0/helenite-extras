import { button } from "./button";

export type Tone = "default" | "accent" | "danger" | "success" | "warning";

/** Where a state sits: `centered` (the default, padded), `inline` (a left-aligned settings line), `pane` (a sidebar pane). */
export type StateVariant = "centered" | "inline" | "pane";

export function make(parent: HTMLElement, tag: string, cls: string[], text?: string): HTMLElement {
  const el = parent.ownerDocument.createElement(tag);
  el.classList.add(...cls);
  if (text !== undefined) el.textContent = text;
  parent.appendChild(el);
  return el;
}

/** Obsidian's own class for each variant, so a theme's look for it still applies. */
const EMPTY_VARIANT: Record<StateVariant, string[]> = {
  centered: [],
  inline: ["is-inline", "setting-item-description"],
  pane: ["is-pane", "pane-empty"],
};

export function emptyState(parent: HTMLElement, text: string, o: { variant?: StateVariant } = {}): HTMLElement {
  return make(parent, "div", ["hel-empty", ...EMPTY_VARIANT[o.variant ?? "centered"]], text);
}

export function loadingState(parent: HTMLElement, text = "Loading…"): HTMLElement {
  const el = make(parent, "div", ["hel-loading"], text);
  el.setAttribute("role", "status");
  return el;
}

export interface ErrorStateOptions {
  variant?: StateVariant;
  /** The retry button's text. Default "Try again". */
  retryLabel?: string;
}

export function errorState(parent: HTMLElement, text: string, retry?: () => void, o: ErrorStateOptions = {}): HTMLElement {
  const variant = o.variant ?? "centered";
  const el = make(parent, "div", ["hel-error", ...(variant === "centered" ? [] : [`is-${variant}`])]);
  el.setAttribute("role", "alert");
  make(el, "span", ["hel-error-text"], text);
  if (retry) button(el, { text: o.retryLabel ?? "Try again", onClick: () => retry() });
  return el;
}

export function badge(parent: HTMLElement, text: string, tone: Tone = "default"): HTMLElement {
  return make(parent, "span", ["hel-badge", `is-${tone}`], text);
}

export function statusDot(parent: HTMLElement, tone: Tone, label: string, o: { pulse?: boolean } = {}): HTMLElement {
  const el = make(parent, "span", ["hel-status-dot", `is-${tone}`]);
  if (o.pulse) el.classList.add("is-pulse");
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", label);
  return el;
}

/** The element `statusText` returns: a span that can also change its tone. */
export type StatusTextElement = HTMLElement & {
  /** Recolours the status (its text is the span's own: `setText` / `textContent`). */
  setTone(t: Tone): void;
};

/** A short status in words ("Connected", "Not signed in"), coloured by tone. */
export function statusText(parent: HTMLElement, text: string, tone: Tone = "default"): StatusTextElement {
  const el = make(parent, "span", ["hel-status-text", `is-${tone}`], text) as StatusTextElement;
  let current = tone;
  el.setTone = (t) => {
    el.classList.remove(`is-${current}`);
    current = t;
    el.classList.add(`is-${t}`);
  };
  return el;
}
