import { card, type CardHandle, type CardTone } from "./card";
import { make } from "./states";

export interface BoardOptions {
  /** The board's accessible name. */
  label?: string;
  /** A card was dropped on a lane, before the `index`th of its cards (not counting the dragged one). Makes cards draggable. */
  onDrop?: (id: string, lane: string, index: number) => void;
  /** A card started being dragged. Do not redraw the board until `onDragEnd`. */
  onDragStart?: (id: string) => void;
  /** The drag is over, dropped or not. Runs before `onDrop`. */
  onDragEnd?: () => void;
}

export interface BoardLaneOptions {
  /** What `onDrop` reports, and the lane's `data-lane`. */
  id: string;
  /** The lane's accessible name. */
  label: string;
  /** The lane's name, drawn first in its head; a long one wraps. */
  title?: string;
  /** Makes the title a button (to rename the lane, say). */
  onTitleClick?: () => void;
}

export interface BoardCardOptions {
  /** What the drag callbacks report, and the card's `data-id`. */
  id: string;
  title?: string;
  tone?: CardTone;
  /** The card's accessible name when `onOpen` makes it a button. Defaults to the title. */
  label?: string;
  /** Makes the card a button: a click, Enter or Space on it (not on a control inside it) calls this. */
  onOpen?: () => void;
  /** False for a card that stays where it is. */
  draggable?: boolean;
  /** A done checkbox at the start of the card's row. */
  check?: BoardCardCheck;
}

export interface BoardCardCheck {
  checked: boolean;
  /** The checkbox's accessible name, e.g. "Mark card as done". */
  label: string;
  /** The checkbox was ticked or cleared. It does not redraw the card: change your data and redraw. */
  onToggle: (checked: boolean) => void;
}

export interface BoardCardHandle extends CardHandle {
  /** Draw the card's text or rendered markdown into this, beside the checkbox. The margins at its edges are trimmed. */
  content: HTMLElement;
  /** Buttons at the far end of the content's first line (a `ui.moreButton`). Not shown while empty. */
  actions: HTMLElement;
  /** A wrapping row for chips and badges, under the content's row. Not shown while empty. */
  meta: HTMLElement;
}

export interface BoardLaneHandle {
  el: HTMLElement;
  /** Draw the lane's count and actions (and its name, without `title`) into this. Not shown while empty. */
  head: HTMLElement;
  /** The cards, scrolling on their own. Draw an empty state or a "load more" button into it too. */
  list: HTMLElement;
  /** Under the cards, for an "Add a card" button: it follows a short list and stays in view under a long one. Not shown while empty. */
  footer: HTMLElement;
  card(o: BoardCardOptions): BoardCardHandle;
}

export interface BoardHandle {
  el: HTMLElement;
  lane(o: BoardLaneOptions): BoardLaneHandle;
}

/** What a click or a key press belongs to instead of the card around it. */
const CONTROLS = "button, a, input, select, textarea, label";

function drawTitle(head: HTMLElement, text: string, onClick?: () => void): void {
  const title = make(head, onClick ? "button" : "span", ["hel-board-lane-title"], text);
  if (!onClick) return;
  (title as HTMLButtonElement).type = "button";
  title.addEventListener("click", () => onClick());
}

/** In a label of its own, so the design system's checkbox look applies and a click on it never opens the card. */
function drawCheck(row: HTMLElement, check: BoardCardCheck): void {
  const box = make(make(row, "label", ["hel-check", "hel-board-card-check"]), "input", []) as HTMLInputElement;
  box.type = "checkbox";
  box.checked = check.checked;
  box.setAttribute("aria-label", check.label);
  box.addEventListener("change", () => check.onToggle(box.checked));
}

/** A fixed-height row of lanes that scrolls sideways, with cards dragged between and within them. */
export function board(parent: HTMLElement, o: BoardOptions = {}): BoardHandle {
  const el = make(parent, "div", ["hel-board"]);
  el.setAttribute("role", "group");
  if (o.label) el.setAttribute("aria-label", o.label);
  let dragged: { id: string; el: HTMLElement } | null = null;
  const unmark = (): void => el.querySelectorAll(".hel-board-list.is-drop-target").forEach((l) => l.classList.remove("is-drop-target"));
  const finish = (): void => {
    if (!dragged) return;
    dragged.el.classList.remove("is-dragging");
    dragged = null;
    unmark();
    o.onDragEnd?.();
  };

  const wireDrag = (c: HTMLElement, id: string): void => {
    c.setAttribute("draggable", "true");
    c.addEventListener("dragstart", (e) => {
      (e as DragEvent).dataTransfer?.setData("text/plain", id);
      c.classList.add("is-dragging");
      dragged = { id, el: c };
      o.onDragStart?.(id);
    });
    c.addEventListener("dragend", finish);
  };

  // The whole lane takes the drop: with a footer the list is only as tall as its cards.
  const wireDrop = ({ el: laneEl, head, list, footer }: Omit<BoardLaneHandle, "card">, lane: string): void => {
    laneEl.addEventListener("dragover", (e) => {
      if (!dragged) return;
      e.preventDefault();
      list.classList.add("is-drop-target");
    });
    laneEl.addEventListener("dragleave", (e) => {
      // Also fired when the pointer moves between the lane's own children.
      if (!laneEl.contains((e as DragEvent).relatedTarget as Node | null)) list.classList.remove("is-drop-target");
    });
    laneEl.addEventListener("drop", (e) => {
      if (!dragged) return;
      e.preventDefault();
      const { id, el: moving } = dragged;
      const others = Array.from(list.querySelectorAll<HTMLElement>(":scope > .hel-board-card")).filter((c) => c !== moving);
      let index = others.findIndex((c) => {
        const r = c.getBoundingClientRect();
        return (e as DragEvent).clientY < r.top + r.height / 2;
      });
      if (index < 0) index = others.length;
      // The head is the top and the footer the end, wherever a scrolled list has put its cards under them.
      if (head.contains(e.target as Node)) index = 0;
      else if (footer.contains(e.target as Node)) index = others.length;
      // Ended here: a redraw may remove the card before its dragend.
      finish();
      o.onDrop!(id, lane, index);
    });
  };

  const lane = (l: BoardLaneOptions): BoardLaneHandle => {
    const laneEl = make(el, "div", ["hel-board-lane"]);
    laneEl.dataset.lane = l.id;
    laneEl.setAttribute("role", "group");
    laneEl.setAttribute("aria-label", l.label);
    const head = make(laneEl, "div", ["hel-board-lane-head"]);
    if (l.title !== undefined) drawTitle(head, l.title, l.onTitleClick);
    const list = make(laneEl, "div", ["hel-board-list"]);
    const footer = make(laneEl, "div", ["hel-board-lane-footer"]);
    if (o.onDrop) wireDrop({ el: laneEl, head, list, footer }, l.id);
    const addCard = (c: BoardCardOptions): BoardCardHandle => {
      const handle = card(list, { compact: true, ...(c.title !== undefined ? { title: c.title } : {}), ...(c.tone ? { tone: c.tone } : {}) });
      const root = handle.el;
      root.classList.add("hel-board-card");
      root.dataset.id = c.id;
      if (o.onDrop && c.draggable !== false) wireDrag(root, c.id);
      const open = c.onOpen;
      if (open) {
        root.classList.add("is-clickable");
        root.tabIndex = 0;
        root.setAttribute("role", "button");
        const name = c.label ?? c.title;
        if (name) root.setAttribute("aria-label", name);
        root.addEventListener("click", (e) => {
          const control = (e.target as Element).closest(CONTROLS);
          if (!control || !root.contains(control)) open();
        });
        root.addEventListener("keydown", (e) => {
          if (e.target !== root || (e.key !== "Enter" && e.key !== " ")) return;
          e.preventDefault();
          open();
        });
      }
      const row = make(handle.body, "div", ["hel-board-card-row"]);
      if (c.check) drawCheck(row, c.check);
      const content = make(row, "div", ["hel-board-card-content", "markdown-rendered"]);
      const actions = make(row, "div", ["hel-board-card-actions"]);
      return { ...handle, content, actions, meta: make(handle.body, "div", ["hel-board-card-meta"]) };
    };
    return { el: laneEl, head, list, footer, card: addCard };
  };

  return { el, lane };
}
