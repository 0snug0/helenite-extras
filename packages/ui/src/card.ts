import { renderIcon } from "./icons";
import { make } from "./states";

export type CardTone = "default" | "accent" | "warning" | "muted";

export interface CardOptions {
  title?: string;
  icon?: string;
  tone?: CardTone;
  /** Less padding, for a card in a list of cards. */
  compact?: boolean;
  /**
   * A card that waits on the user (an agent's question): a thick border and a tint in its tone, a title in the tone's
   * colour, text at the size of the page around it, and a focus ring while focus is inside.
   */
  attention?: boolean;
  /** Stays at the top of its scrolling pane while the content under it scrolls, raised by a shadow. */
  sticky?: boolean;
}

export interface CardHandle {
  el: HTMLElement;
  /** Holds the icon and title; add actions or a status here. Not shown while empty. */
  head: HTMLElement;
  /** Draw the card's content into this. */
  body: HTMLElement;
  setTone(t: CardTone): void;
  /** Dims the card and ignores the pointer while something it started runs (`aria-busy`). */
  setBusy(b: boolean): void;
  /** Pulses the card's outline a few times to draw the eye. Nothing moves under reduced motion. */
  pulse(): void;
}

const PULSE_MS = 2400;

/** A bordered block with an optional head (icon, title) and a body. */
export function card(parent: HTMLElement, o: CardOptions = {}): CardHandle {
  const el = make(parent, "div", ["hel-card"]);
  if (o.compact) el.classList.add("is-compact");
  if (o.attention) el.classList.add("is-attention");
  if (o.sticky) el.classList.add("is-sticky");
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
  const setBusy = (b: boolean): void => {
    el.classList.toggle("is-busy", b);
    if (b) el.setAttribute("aria-busy", "true");
    else el.removeAttribute("aria-busy");
  };
  let pulseTimer: ReturnType<typeof setTimeout> | undefined;
  const pulse = (): void => {
    clearTimeout(pulseTimer);
    el.classList.add("is-pulse");
    pulseTimer = setTimeout(() => el.classList.remove("is-pulse"), PULSE_MS);
  };
  return { el, head, body, setTone, setBusy, pulse };
}
