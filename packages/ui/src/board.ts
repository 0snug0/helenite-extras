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
}

export interface BoardCardHandle extends CardHandle {
  /** A wrapping row for chips and badges, first in the body. Not shown while empty. */
  meta: HTMLElement;
}

export interface BoardLaneHandle {
  el: HTMLElement;
  /** Draw the lane's name, count and actions into this. Not shown while empty. */
  head: HTMLElement;
  /** The cards, scrolling on their own. Draw an empty state or a "load more" button into it too. */
  list: HTMLElement;
  card(o: BoardCardOptions): BoardCardHandle;
}

export interface BoardHandle {
  el: HTMLElement;
  lane(o: BoardLaneOptions): BoardLaneHandle;
}

/** What a click or a key press belongs to instead of the card around it. */
const CONTROLS = "button, a, input, select, textarea, label";

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

  const wireDrop = (list: HTMLElement, lane: string): void => {
    list.addEventListener("dragover", (e) => {
      if (!dragged) return;
      e.preventDefault();
      list.classList.add("is-drop-target");
    });
    list.addEventListener("dragleave", (e) => {
      // Also fired when the pointer moves between the list's own children.
      if (!list.contains((e as DragEvent).relatedTarget as Node | null)) list.classList.remove("is-drop-target");
    });
    list.addEventListener("drop", (e) => {
      if (!dragged) return;
      e.preventDefault();
      const { id, el: moving } = dragged;
      const others = Array.from(list.querySelectorAll<HTMLElement>(":scope > .hel-board-card")).filter((c) => c !== moving);
      let index = others.findIndex((c) => {
        const r = c.getBoundingClientRect();
        return (e as DragEvent).clientY < r.top + r.height / 2;
      });
      if (index < 0) index = others.length;
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
    const list = make(laneEl, "div", ["hel-board-list"]);
    if (o.onDrop) wireDrop(list, l.id);
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
      return { ...handle, meta: make(handle.body, "div", ["hel-board-card-meta"]) };
    };
    return { el: laneEl, head, list, card: addCard };
  };

  return { el, lane };
}
