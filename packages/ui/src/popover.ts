import { renderIcon } from "./icons";
import { make } from "./states";

let popoverCounter = 0;

/** What a popover opens at: an element, a point, or a rectangle such as a caret's (client coordinates). */
export type PopoverAnchor =
  | Element
  | { x: number; y: number }
  | { left: number; right: number; top: number; bottom: number };

/** `escape` and `outside` are the user's; `close` is `close()`, another popover opening, or the element being removed. */
export type PopoverCloseReason = "escape" | "outside" | "close";

export interface PopoverOptions {
  title?: string;
  icon?: string;
  /** The accessible name of a popover with no title. */
  label?: string;
  /** What the popover is about, such as the selected text: a `<blockquote>` first in the body, drawn as written. */
  quote?: string;
  /** The side of the anchor it opens on while it fits there. Default "bottom". */
  side?: "bottom" | "top";
  /** The width in px. Default `--hel-popover-width` (320px). */
  width?: number;
  /** Where focus goes when it closes. Default: what had focus when it opened. */
  returnFocus?: HTMLElement | null;
  /** The document to draw in. By default an element anchor's own. */
  document?: Document;
  /** Runs once when it closes, after focus has gone back (except after an outside click, which settles it later). */
  onClose?: (reason: PopoverCloseReason) => void;
}

export interface PopoverHandle {
  el: HTMLElement;
  /** Holds the icon and title. Not shown while empty. */
  head: HTMLElement;
  /** Draw the popover's content into this. It scrolls when the window is too short. */
  body: HTMLElement;
  /** A strip under the body for actions or a status. Not shown while empty. */
  footer: HTMLElement;
  /** The title element, or null when there is no title. */
  titleEl: HTMLElement | null;
  /** Places it again. Its content, the window's size and scrolling (with an element anchor) are followed without this. */
  update(): void;
  close(): void;
}

/** The space kept between the popover and the window's edges, and between it and its anchor. */
const MARGIN = 8;
const GAP = 6;
/** The least height a popover is squeezed to when neither side of the anchor has room. */
const MIN_HEIGHT = 160;
/** Clicks on these are not "outside": menus, suggestion lists and notices opened from the popover sit on the body. */
const LAYERS = ".menu, .suggestion-container, .notice-container";
const FOCUSABLE =
  'input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), a[href], [contenteditable]:not([contenteditable=false]), [tabindex]:not([tabindex="-1"])';

/** The popover open in each document: opening another closes it. */
const openIn = new WeakMap<Document, () => void>();

/**
 * A floating panel at an anchor (an element, a point or a caret's rectangle) with a title, a body and a footer. It stays
 * inside the window, flipping above the anchor or to its other edge when it has to, and closes on Escape or a click
 * outside it, giving focus back. `null` centers it. One is open at a time.
 */
export function popover(at: PopoverAnchor | null, o: PopoverOptions = {}): PopoverHandle {
  const anchor = at && "nodeType" in at ? at : null;
  const doc = o.document ?? anchor?.ownerDocument ?? o.returnFocus?.ownerDocument ?? document;
  const win = doc.defaultView ?? window;
  openIn.get(doc)?.();
  const previous = doc.activeElement as HTMLElement | null;
  // With a modal open it joins that modal's layer (the one it was opened from, else the topmost), so it draws above the
  // modal and goes away with it.
  const modals = doc.querySelectorAll(".modal-container");
  const host = anchor?.closest(".modal-container") ?? previous?.closest(".modal-container") ?? modals[modals.length - 1] ?? doc.body;

  const el = make(host as HTMLElement, "div", ["hel-popover"]);
  el.setAttribute("role", "dialog");
  el.tabIndex = -1;
  if (o.width !== undefined) el.style.setProperty("--hel-popover-width", `${o.width}px`);
  const head = make(el, "div", ["hel-popover-head"]);
  if (o.icon) renderIcon(make(head, "span", ["hel-popover-icon"]), o.icon);
  let titleEl: HTMLElement | null = null;
  if (o.title !== undefined) {
    titleEl = make(head, "div", ["hel-popover-title"], o.title);
    titleEl.id = `hel-popover-${++popoverCounter}-title`;
    el.setAttribute("aria-labelledby", titleEl.id);
  } else if (o.label !== undefined) el.setAttribute("aria-label", o.label);
  const body = make(el, "div", ["hel-popover-body"]);
  if (o.quote !== undefined) make(body, "blockquote", ["hel-popover-quote"], o.quote);
  const footer = make(el, "div", ["hel-popover-footer"]);

  let open = true;
  let rect = anchorRect(at);

  const update = (): void => {
    if (!open) return;
    if (anchor?.isConnected) rect = anchorRect(anchor);
    place(el, rect, o.side ?? "bottom", win);
  };
  const close = (reason: PopoverCloseReason = "close"): void => {
    if (!open) return;
    open = false;
    openIn.delete(doc);
    doc.removeEventListener("mousedown", onMouseDown, true);
    doc.removeEventListener("keydown", onKey);
    doc.removeEventListener("scroll", onScroll, true);
    win.removeEventListener("resize", update);
    resized?.disconnect();
    removed.disconnect();
    // Focus goes back only if it was here (or went with the element): never taken from where the user has moved to.
    const had = el.contains(doc.activeElement) || lost(doc);
    el.remove();
    const target = o.returnFocus ?? previous;
    const back = (): void => {
      if (target?.isConnected && target !== doc.body) target.focus({ preventScroll: true });
    };
    if (had && reason !== "outside") back();
    // An outside click focuses what it hit after this handler: give focus back only if it hit nothing focusable.
    else if (had) win.setTimeout(() => lost(doc) && back(), 0);
    o.onClose?.(reason);
  };

  const onMouseDown = (e: Event): void => {
    const t = e.target as Element;
    if (el.contains(t) || anchor?.contains(t) || t.closest?.(LAYERS)) return;
    close("outside");
  };
  const onKey = (e: KeyboardEvent): void => {
    // Something inside that used the Escape (a composer's "/" menu) has prevented it.
    if (e.key !== "Escape" || e.defaultPrevented || e.isComposing) return;
    e.preventDefault();
    e.stopPropagation();
    close("escape");
  };
  const onScroll = (e: Event): void => {
    if (!el.contains(e.target as Node)) update();
  };
  // On the element too, so an Escape from inside stops here; the document's takes one from anywhere else.
  el.addEventListener("keydown", onKey);
  doc.addEventListener("keydown", onKey);
  doc.addEventListener("mousedown", onMouseDown, true);
  doc.addEventListener("scroll", onScroll, true);
  win.addEventListener("resize", update);
  const resized = typeof win.ResizeObserver === "function" ? new win.ResizeObserver(() => update()) : null;
  resized?.observe(el);
  const removed = new win.MutationObserver(() => {
    if (!el.isConnected) close();
  });
  removed.observe(doc.body, { childList: true, subtree: true });
  openIn.set(doc, close);

  update();
  // Once the caller has drawn into it: place it for its real size, and focus it unless the caller already did.
  queueMicrotask(() => {
    if (!open) return;
    update();
    if (!el.contains(doc.activeElement)) (el.querySelector<HTMLElement>(FOCUSABLE) ?? el).focus({ preventScroll: true });
  });

  return { el, head, body, footer, titleEl, update, close: () => close() };
}

/** Focus is nowhere: on the body, or on an element no longer in the page. */
function lost(doc: Document): boolean {
  const a = doc.activeElement;
  return !a || a === doc.body || !a.isConnected;
}

interface Box { left: number; right: number; top: number; bottom: number }

function anchorRect(at: PopoverAnchor | null): Box | null {
  if (!at) return null;
  if ("nodeType" in at) return at.getBoundingClientRect();
  // A rectangle first: a DOMRect has x and y as well.
  if ("left" in at) return at;
  return { left: at.x, right: at.x, top: at.y, bottom: at.y };
}

function place(el: HTMLElement, a: Box | null, side: "bottom" | "top", win: Window): void {
  const vw = win.innerWidth;
  const vh = win.innerHeight;
  const scrolled = el.querySelector<HTMLElement>(":scope > .hel-popover-body");
  const scrollTop = scrolled?.scrollTop ?? 0;
  el.style.maxHeight = "";
  const { width, height } = el.getBoundingClientRect();
  const within = (v: number, size: number, extent: number): number => Math.max(MARGIN, Math.min(v, extent - size - MARGIN));
  let left: number;
  let top: number;
  let used = side;
  if (!a) {
    left = (vw - width) / 2;
    top = within(vh * 0.3, height, vh);
    used = "bottom";
  } else {
    // Left edges aligned; its right edge on the anchor's near the window's right side.
    left = a.left;
    if (left + width > vw - MARGIN && a.right - width >= MARGIN && a.right <= vw - MARGIN) left = a.right - width;
    const room = { bottom: vh - a.bottom - GAP - MARGIN, top: a.top - GAP - MARGIN };
    const other = side === "bottom" ? "top" : "bottom";
    if (height > room[side] && (height <= room[other] || room[other] > room[side])) used = other;
    let h = height;
    if (h > room[used]) {
      h = Math.min(h, Math.max(room[used], MIN_HEIGHT), vh - 2 * MARGIN);
      el.style.maxHeight = `${h}px`;
    }
    top = within(used === "bottom" ? a.bottom + GAP : a.top - GAP - h, h, vh);
  }
  el.style.left = `${within(left, width, vw)}px`;
  el.style.top = `${top}px`;
  el.dataset.side = used;
  // Lifting the height cap to measure can reset the body's scroll position.
  if (scrolled) scrolled.scrollTop = scrollTop;
}
