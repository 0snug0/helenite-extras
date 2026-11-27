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

export interface LoadingStateOptions {
  /** A determinate progress bar, 0 to 1. Leave out for the spinner. */
  progress?: number;
  /** How long before the line shows, in ms, so a fast load never flashes it. Default 200; 0 shows it at once. */
  delayMs?: number;
}

/** What `loadingState` returns; `setProgress` moves the bar (`undefined` goes back to the spinner). */
export type LoadingStateElement = HTMLElement & { setProgress(p: number | undefined): void };

/**
 * A "Loading…" line with a spinner, or with a progress bar when `progress` (0 to 1) is given. It takes its space at
 * once and becomes visible after `delayMs`, so draw it as soon as the wait starts and remove it when the data is there.
 */
export function loadingState(parent: HTMLElement, text = "Loading…", o: LoadingStateOptions = {}): LoadingStateElement {
  const el = make(parent, "div", ["hel-loading"]) as LoadingStateElement;
  el.setAttribute("role", "status");
  if (o.delayMs !== undefined) el.style.setProperty("--hel-loading-delay", `${Math.max(0, o.delayMs)}ms`);
  make(el, "span", ["hel-spinner"]).setAttribute("aria-hidden", "true");
  make(el, "span", ["hel-loading-text"], text);
  const bar = make(el, "div", ["hel-progress"]);
  bar.setAttribute("role", "progressbar");
  bar.setAttribute("aria-valuemin", "0");
  bar.setAttribute("aria-valuemax", "100");
  bar.setAttribute("aria-label", text);
  const fill = make(bar, "div", ["hel-progress-fill"]);
  el.setProgress = (p) => {
    const on = p !== undefined && Number.isFinite(p);
    el.classList.toggle("is-determinate", on);
    if (on) {
      const pct = Math.round(Math.min(1, Math.max(0, p)) * 100);
      bar.setAttribute("aria-valuenow", String(pct));
      fill.style.width = `${pct}%`;
    } else {
      bar.removeAttribute("aria-valuenow");
      fill.style.removeProperty("width");
    }
  };
  el.setProgress(o.progress);
  return el;
}

/** What `loadingLine` returns. */
export interface LoadingLine {
  /** As `loadingState`. `key` names the wait (default: the text): a new one starts the delay afresh. */
  draw(parent: HTMLElement, text?: string, o?: LoadingStateOptions & { key?: string }): LoadingStateElement;
  /** The wait is over: the next one starts its delay afresh. */
  clear(): void;
}

/**
 * The loading line of a view that redraws while it waits, made once per view. The delay before it shows runs from when
 * the wait began, so redraws more frequent than the delay cannot keep it hidden.
 */
export function loadingLine(): LoadingLine {
  let key: string | undefined;
  let since = 0;
  return {
    draw(parent, text = "Loading…", o = {}) {
      const now = Date.now();
      const wait = o.key ?? text;
      if (wait !== key) { key = wait; since = now; }
      return loadingState(parent, text, { ...o, delayMs: Math.max(0, (o.delayMs ?? 200) - (now - since)) });
    },
    clear() { key = undefined; },
  };
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
