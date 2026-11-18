import { renderIcon } from "./icons";
import { make } from "./states";

export type CardTone = "default" | "accent" | "warning" | "muted";

export interface CardOptions {
  title?: string;
  icon?: string;
  tone?: CardTone;
  /** Less padding, for a card in a list of cards. */
  compact?: boolean;
}

export interface CardHandle {
  el: HTMLElement;
  /** Holds the icon and title; add actions or a status here. Not shown while empty. */
  head: HTMLElement;
  /** Draw the card's content into this. */
  body: HTMLElement;
  setTone(t: CardTone): void;
}

/** A bordered block with an optional head (icon, title) and a body. */
export function card(parent: HTMLElement, o: CardOptions = {}): CardHandle {
  const el = make(parent, "div", ["hel-card"]);
  if (o.compact) el.classList.add("is-compact");
  const head = make(el, "div", ["hel-card-head"]);
  if (o.icon) renderIcon(make(head, "span", ["hel-card-icon"]), o.icon);
  if (o.title !== undefined) make(head, "div", ["hel-card-title"], o.title);
  const body = make(el, "div", ["hel-card-body"]);
  let tone: CardTone = "default";
  const setTone = (t: CardTone): void => {
    el.classList.remove(`is-${tone}`);
    tone = t;
    if (t !== "default") el.classList.add(`is-${t}`);
  };
  setTone(o.tone ?? "default");
  return { el, head, body, setTone };
}
