import { button } from "./button";
import { renderIcon } from "./icons";
import { joinField } from "./field";
import { make } from "./states";

let composerCounter = 0;

/** An entry in the composer's "/" menu. */
export interface SlashCommand {
  name: string;
  description?: string;
}

/** What the composer needs from its text box: a textarea, or an element that behaves like one (an editor's content area). */
export type ComposerField = HTMLElement & {
  value: string;
  readOnly: boolean;
  selectionStart: number | null;
  setSelectionRange(start: number, end: number): void;
};

/** A file (or anything else) attached to the message: shown as a removable chip above the box. */
export interface ComposerAttachment {
  name: string;
  /** An icon name for the chip. Default "paperclip". */
  icon?: string;
  /** Whatever the caller needs back on submit, such as a path or a File. */
  data?: unknown;
}

export interface ComposerOptions {
  /**
   * Builds the text box in place of the plain textarea (appended to the composer by the callback), such as an editor.
   * What it appends is drawn as the box (`hel-composer-host`): the textarea's rings and text, at least `rows` lines
   * tall and scrolling past `--hel-composer-max-height` (320px). Showing `placeholder` in it is the caller's job.
   */
  createInput?: (parent: HTMLElement) => ComposerField;
  placeholder?: string;
  /** The text box's height in lines (a custom input's smallest height). Default 3. */
  rows?: number;
  /** The send button's text (and its accessible name with `submitIcon`). Default "Send". */
  submitLabel?: string;
  /** Draws the send button as an icon button instead of a text button. */
  submitIcon?: string;
  /** `enter` (default): Enter sends and Shift+Enter starts a new line. `mod-enter`: Cmd/Ctrl+Enter sends. */
  submitOn?: "enter" | "mod-enter";
  /** A line under the box, such as the key that sends. */
  hint?: string;
  /** Sends an empty box too, for a send button that starts something whose text is optional. */
  allowEmpty?: boolean;
  /**
   * Gets the text. The box is cleared when it returns, or when its promise resolves (busy until then). Returning (or
   * resolving to) `false` means nothing was sent and keeps the text, as a throw does.
   */
  onSubmit: (text: string, attachments?: ComposerAttachment[]) => unknown;
  /**
   * Turns on attachments: an attach button beside the box that calls this and adds what it returns as chips. The chips
   * go to `onSubmit` and are cleared with the text. Without it there is no button; `addAttachment` still works.
   */
  onAttach?: () => ComposerAttachment[] | void | Promise<ComposerAttachment[] | void>;
  /** The attach button's accessible name. Default "Attach". */
  attachLabel?: string;
  /**
   * Turns on a "/" menu: typing "/" at the start of the box lists these, filtered as you type. Arrow keys move, Enter or
   * Tab inserts `/name ` and Escape closes. Called once, the first time the menu opens.
   */
  slashCommands?: () => SlashCommand[] | Promise<SlashCommand[]>;
}

export interface ComposerHandle {
  el: HTMLElement;
  input: ComposerField;
  setBusy(b: boolean): void;
  focus(): void;
  /** Clears the text and the attachments. */
  clear(): void;
  /** Adds an attachment chip; returns a function that removes it. */
  addAttachment(a: ComposerAttachment): () => void;
  attachments(): ComposerAttachment[];
}

/** A multiline text box with a send button. Empty (or blank) text is not sent, unless `allowEmpty` or it has an attachment. */
export function composer(parent: HTMLElement, o: ComposerOptions): ComposerHandle {
  const el = make(parent, "div", ["hel-composer"]);
  let input: ComposerField;
  if (o.createInput) {
    input = o.createInput(el);
    hostInput(el, input, o.rows ?? 3);
  } else {
    const ta = make(el, "textarea", ["hel-composer-input"]) as HTMLTextAreaElement;
    ta.rows = o.rows ?? 3;
    if (o.placeholder !== undefined) ta.placeholder = o.placeholder;
    input = ta;
  }
  const chips = make(el, "div", ["hel-composer-attachments"]);
  chips.hidden = true;
  el.insertBefore(chips, el.firstChild);
  const field = parent.classList.contains("hel-field-control");
  if (!field) input.setAttribute("aria-label", o.placeholder ?? "Message");
  joinField(parent, input);
  let busy = false;
  const attached: ComposerAttachment[] = [];
  const addAttachment = (a: ComposerAttachment): (() => void) => {
    const chip = make(chips, "span", ["hel-composer-attachment"]);
    const icon = make(chip, "span", ["hel-composer-attachment-icon"]);
    renderIcon(icon, a.icon ?? "paperclip");
    icon.setAttribute("aria-hidden", "true");
    make(chip, "span", ["hel-composer-attachment-name"], a.name).title = a.name;
    const x = button(chip, { variant: "icon", icon: "x", label: `Remove ${a.name}` });
    x.el.classList.add("hel-composer-attachment-remove");
    attached.push(a);
    chips.hidden = false;
    const remove = (): void => {
      const i = attached.indexOf(a);
      if (i < 0) return;
      attached.splice(i, 1);
      chip.remove();
      chips.hidden = attached.length === 0;
    };
    x.el.addEventListener("click", () => {
      remove();
      input.focus();
    });
    return remove;
  };
  if (o.onAttach) {
    el.classList.add("has-attach");
    const attach = button(el, { variant: "icon", icon: "paperclip", label: o.attachLabel ?? "Attach" });
    attach.el.classList.add("hel-composer-attach");
    // Before the box: the grid places its cells in DOM order, and the box takes the wide middle column.
    el.insertBefore(attach.el, chips.nextSibling);
    attach.el.addEventListener("click", () => {
      if (busy) return;
      void Promise.resolve()
        .then(o.onAttach)
        .then((list) => {
          for (const a of list ?? []) addAttachment(a);
        })
        .catch((err) => console.error(err));
    });
  }
  const label = o.submitLabel ?? "Send";
  const send = button(el, o.submitIcon ? { variant: "icon", icon: o.submitIcon, label } : { text: label, variant: "primary" });
  send.el.classList.add("hel-composer-send");
  if (o.hint !== undefined) {
    const hint = make(el, "div", ["hel-composer-hint"], o.hint);
    hint.id = `hel-composer-${++composerCounter}-hint`;
    const describedby = [input.getAttribute("aria-describedby"), hint.id].filter(Boolean).join(" ");
    input.setAttribute("aria-describedby", describedby);
  }

  const setBusy = (b: boolean): void => {
    busy = b;
    el.classList.toggle("is-busy", b);
    // Read-only while busy, so text typed during a send is not wiped when the box clears.
    input.readOnly = b;
    send.setBusy(b);
  };
  const clear = (): void => {
    input.value = "";
    for (const chip of chips.querySelectorAll(".hel-composer-attachment")) chip.remove();
    attached.length = 0;
    chips.hidden = true;
  };
  const submit = (): void => {
    const text = input.value;
    if (busy || (!text.trim() && !o.allowEmpty && !attached.length)) return;
    let result: unknown;
    try {
      // The attachments are passed only when there are some, so a caller that ignores them sees its old one-argument call.
      result = attached.length ? o.onSubmit(text, [...attached]) : (o.onSubmit as (text: string) => unknown)(text);
    } catch (err) {
      console.error(err);
      return;
    }
    if (result && typeof (result as PromiseLike<unknown>).then === "function") {
      setBusy(true);
      (result as PromiseLike<unknown>).then(
        (r) => {
          setBusy(false);
          if (r !== false) clear();
        },
        (err) => {
          setBusy(false);
          console.error(err);
        },
      );
    } else if (result !== false) {
      clear();
    }
  };
  if (o.slashCommands) slashMenu(el, input, o.slashCommands);
  // An IME's Enter confirms its text, not the message: tracked by the composition events too, as some engines report
  // isComposing false on that keydown.
  let composing = false;
  input.addEventListener("compositionstart", () => (composing = true));
  input.addEventListener("compositionend", () => (composing = false));
  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.isComposing || composing) return;
    const mod = e.metaKey || e.ctrlKey;
    if (o.submitOn === "mod-enter" ? !mod : e.shiftKey) return;
    e.preventDefault();
    submit();
  });
  send.el.addEventListener("click", submit);
  return { el, input, setBusy, focus: () => input.focus(), clear, addAttachment, attachments: () => [...attached] };
}

/**
 * Draws the composer's child that holds a custom input as the text box. The class goes there, not on the input: an
 * editor rewrites its content element's classes.
 */
function hostInput(el: HTMLElement, input: ComposerField, rows: number): void {
  let box: HTMLElement = input;
  while (box.parentElement && box.parentElement !== el) box = box.parentElement;
  box.classList.add("hel-composer-host");
  box.style.setProperty("--hel-composer-rows", String(rows));
  // A textarea focuses from anywhere in its box; do the same for the padding around the input (not its scrollbars).
  box.addEventListener("mousedown", (e) => {
    if (e.target !== box || box === input || e.offsetX >= box.clientWidth || e.offsetY >= box.clientHeight) return;
    e.preventDefault();
    input.focus();
  });
}

/** The "/" menu: a listbox above the box, driven from the textarea (focus stays there). */
function slashMenu(el: HTMLElement, input: ComposerField, load: () => SlashCommand[] | Promise<SlashCommand[]>): void {
  const id = `hel-composer-${++composerCounter}-menu`;
  const menu = make(el, "div", ["hel-composer-menu"]);
  menu.id = id;
  menu.setAttribute("role", "listbox");
  menu.setAttribute("aria-label", "Commands");
  menu.hidden = true;
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-controls", id);
  input.setAttribute("aria-expanded", "false");

  let all: SlashCommand[] | null = null;
  let loading: Promise<void> | null = null;
  let shown: SlashCommand[] = [];
  let active = 0;

  /** The text after "/" when the caret is still in the first word, which starts with "/"; otherwise null. */
  const query = (): string | null => {
    const before = input.value.slice(0, input.selectionStart ?? input.value.length);
    const m = /^\/(\S*)$/.exec(before);
    return m ? m[1].toLowerCase() : null;
  };
  const close = (): void => {
    shown = [];
    menu.hidden = true;
    menu.textContent = "";
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
  };
  const highlight = (i: number): void => {
    active = (i + shown.length) % shown.length;
    menu.querySelectorAll<HTMLElement>(".hel-composer-menu-item").forEach((item, k) => {
      item.classList.toggle("is-selected", k === active);
      item.setAttribute("aria-selected", String(k === active));
      if (k === active) {
        input.setAttribute("aria-activedescendant", item.id);
        // By hand, not scrollIntoView: that could also scroll the pane the composer sits in.
        if (item.offsetTop < menu.scrollTop) menu.scrollTop = item.offsetTop;
        else if (item.offsetTop + item.offsetHeight > menu.scrollTop + menu.clientHeight) menu.scrollTop = item.offsetTop + item.offsetHeight - menu.clientHeight;
      }
    });
  };
  /** Fixed to the window so a short pane does not clip it: above the box when there is more room there, else below. */
  const place = (): void => {
    const r = input.getBoundingClientRect();
    const vh = input.ownerDocument.defaultView?.innerHeight ?? 0;
    const above = r.top >= vh - r.bottom;
    const room = Math.max(80, (above ? r.top : vh - r.bottom) - 12);
    Object.assign(menu.style, {
      left: `${r.left}px`,
      width: `${r.width}px`,
      maxHeight: `${Math.min(240, room)}px`,
      top: above ? "" : `${r.bottom + 4}px`,
      bottom: above ? `${vh - r.top + 4}px` : "",
    });
  };
  const pick = (c: SlashCommand): void => {
    const rest = input.value.replace(/^\/\S*/, "").replace(/^ /, "");
    input.value = `/${c.name} ${rest}`;
    const caret = c.name.length + 2;
    input.setSelectionRange(caret, caret);
    close();
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const update = (): void => {
    const q = query();
    if (q === null) return close();
    if (!all) {
      loading ??= Promise.resolve()
        .then(load)
        .then((list) => void (all = list ?? []))
        .catch((err) => {
          console.error(err);
          all = [];
        })
        .then(() => {
          if (input.ownerDocument.activeElement === input) update();
        });
      return;
    }
    // Matches at the start of the name (or of its part after "plugin:") first, then anywhere in it, then in the description.
    const rank = (c: SlashCommand): number => {
      const n = c.name.toLowerCase();
      if (n.startsWith(q) || n.split(":").pop()!.startsWith(q)) return 0;
      if (n.includes(q)) return 1;
      return (c.description ?? "").toLowerCase().includes(q) ? 2 : -1;
    };
    const next = all.map((c) => [rank(c), c] as const).filter(([r]) => r >= 0).sort((a, b) => a[0] - b[0]).map(([, c]) => c);
    if (!next.length) return close();
    shown = next;
    menu.textContent = "";
    shown.forEach((c, k) => {
      const item = make(menu, "div", ["hel-composer-menu-item"]);
      item.id = `${id}-${k}`;
      item.setAttribute("role", "option");
      make(item, "span", ["hel-composer-menu-name"], `/${c.name}`);
      if (c.description) make(item, "span", ["hel-composer-menu-desc"], c.description);
      item.title = c.description ?? "";
      // mousedown, not click: keeps focus (and the caret) in the box.
      item.addEventListener("mousedown", (e) => {
        e.preventDefault();
        pick(c);
      });
    });
    menu.hidden = false;
    place();
    input.setAttribute("aria-expanded", "true");
    highlight(0);
  };

  input.addEventListener("input", update);
  input.addEventListener("click", update);
  input.addEventListener("blur", close);
  // Registered before the composer's own Enter handler, so a pick never sends.
  input.addEventListener("keydown", (e) => {
    if (menu.hidden || e.isComposing) return;
    const stop = (): void => {
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    if (e.key === "ArrowDown") (stop(), highlight(active + 1));
    else if (e.key === "ArrowUp") (stop(), highlight(active - 1));
    else if ((e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) || e.key === "Tab") (stop(), pick(shown[active]));
    else if (e.key === "Escape") (stop(), close());
  });
}
