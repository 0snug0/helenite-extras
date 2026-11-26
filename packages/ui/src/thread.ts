import { make, statusText } from "./states";

export interface ThreadOptions {
  /** How many levels of replies indent; deeper ones stay level with the level above. Default 3. */
  maxIndent?: number;
}

export interface Thread {
  /** The list (`hel-thread`, or `hel-thread-replies` under an entry). Draw anything else (a callout, a composer) into it. */
  el: HTMLElement;
  /** Adds one comment: draw its `ui.card` into the entry's `el`. */
  entry(): ThreadEntry;
  /** Adds a muted line for something that happened rather than something said. */
  event(text: string): HTMLElement;
}

export interface ThreadEntry {
  el: HTMLElement;
  /** The replies under this entry, added on the first call after what `el` then holds. */
  replies(): Thread;
}

/** Text as written: line breaks kept, long words wrapped. */
export function threadText(parent: HTMLElement, text = ""): HTMLElement {
  return make(parent, "div", ["hel-thread-text"], text);
}

/** A threaded conversation: spaced entries and event lines, replies indented along a rail. */
export function thread(parent: HTMLElement, o: ThreadOptions = {}): Thread {
  const max = o.maxIndent ?? 3;
  const list = (into: HTMLElement, cls: string[], depth: number): Thread => {
    const el = make(into, "div", cls);
    return {
      el,
      entry() {
        const entry = make(el, "article", ["hel-thread-entry"]);
        let replies: Thread | undefined;
        return {
          el: entry,
          replies: () => (replies ??= list(entry, depth < max ? ["hel-thread-replies"] : ["hel-thread-replies", "is-flat"], depth + 1)),
        };
      },
      event(text) {
        const line = make(el, "div", ["hel-thread-event", "hel-thread-text"]);
        statusText(line, text);
        return line;
      },
    };
  };
  return list(parent, ["hel-thread"], 0);
}
