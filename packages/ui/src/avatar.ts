import { make } from "./states";

export interface AvatarOptions {
  /** Who or what it stands for: initials ("AB") or a full name ("Ada Lovelace"), which is cut to its initials. */
  text: string;
  /** 20px, 28px (the default) or 40px across. */
  size?: "small" | "medium" | "large";
}

/** A letter, digit or emoji: what an initial may be, so brackets and dashes around a name are passed over. */
const INITIAL = /[\p{L}\p{N}\p{Emoji_Presentation}]|\uFE0F/u;

/** What a reader counts as one character: an emoji or an accented letter stays whole. */
const characters = (s: string): string[] => Array.from(new Intl.Segmenter().segment(s), (c) => c.segment);

/** The first and last word's initial; a lone word of one or two characters is taken to be initials already, as is a count ("+12"). */
function initials(name: string): string {
  if (/^\+\d+$/.test(name)) return name;
  const words = name.split(/\s+/).filter((w) => INITIAL.test(w));
  const first = (w: string) => characters(w).find((c) => INITIAL.test(c)) ?? "";
  if (words.length > 1) return first(words[0]) + first(words[words.length - 1]);
  const word = words[0] ?? name;
  const all = characters(word);
  return all.length <= 2 ? word : first(word) || all[0];
}

/** Initials in a circle, for a person or an agent. A screen reader hears the whole `text`. */
export function avatar(parent: HTMLElement, o: AvatarOptions): HTMLElement {
  const name = o.text.normalize().trim() || "?";
  const short = initials(name);
  const upper = short.toUpperCase();
  // A capital that is longer than its letter ("ß" is "SS") would not fit the circle.
  const el = make(parent, "span", ["hel-avatar", `is-${o.size ?? "medium"}`], upper.length === short.length ? upper : short);
  el.title = name;
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", name);
  return el;
}
