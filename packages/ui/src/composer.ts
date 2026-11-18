import { button } from "./button";
import { joinField } from "./field";
import { make } from "./states";

let composerCounter = 0;

export interface ComposerOptions {
  placeholder?: string;
  /** The text box's height in lines. Default 3. */
  rows?: number;
  /** The send button's text (and its accessible name with `submitIcon`). Default "Send". */
  submitLabel?: string;
  /** Draws the send button as an icon button instead of a text button. */
  submitIcon?: string;
  /** `enter` (default): Enter sends and Shift+Enter starts a new line. `mod-enter`: Cmd/Ctrl+Enter sends. */
  submitOn?: "enter" | "mod-enter";
  /** A line under the box, such as the key that sends. */
  hint?: string;
  /** Gets the text. The box is cleared when it returns, or when its promise resolves (busy until then); a throw keeps the text. */
  onSubmit: (text: string) => unknown;
}

export interface ComposerHandle {
  el: HTMLElement;
  input: HTMLTextAreaElement;
  setBusy(b: boolean): void;
  focus(): void;
  clear(): void;
}

/** A multiline text box with a send button. Empty (or blank) text is not sent. */
export function composer(parent: HTMLElement, o: ComposerOptions): ComposerHandle {
  const el = make(parent, "div", ["hel-composer"]);
  const input = make(el, "textarea", ["hel-composer-input"]) as HTMLTextAreaElement;
  input.rows = o.rows ?? 3;
  if (o.placeholder !== undefined) input.placeholder = o.placeholder;
  const field = parent.classList.contains("hel-field-control");
  if (!field) input.setAttribute("aria-label", o.placeholder ?? "Message");
  joinField(parent, input);
  const label = o.submitLabel ?? "Send";
  const send = button(el, o.submitIcon ? { variant: "icon", icon: o.submitIcon, label } : { text: label, variant: "primary" });
  send.el.classList.add("hel-composer-send");
  if (o.hint !== undefined) {
    const hint = make(el, "div", ["hel-composer-hint"], o.hint);
    hint.id = `hel-composer-${++composerCounter}-hint`;
    const describedby = [input.getAttribute("aria-describedby"), hint.id].filter(Boolean).join(" ");
    input.setAttribute("aria-describedby", describedby);
  }

  let busy = false;
  const setBusy = (b: boolean): void => {
    busy = b;
    el.classList.toggle("is-busy", b);
    // Read-only while busy, so text typed during a send is not wiped when the box clears.
    input.readOnly = b;
    send.setBusy(b);
  };
  const clear = (): void => {
    input.value = "";
  };
  const submit = (): void => {
    const text = input.value;
    if (busy || !text.trim()) return;
    let result: unknown;
    try {
      result = o.onSubmit(text);
    } catch (err) {
      console.error(err);
      return;
    }
    if (result && typeof (result as PromiseLike<unknown>).then === "function") {
      setBusy(true);
      (result as PromiseLike<unknown>).then(
        () => {
          setBusy(false);
          clear();
        },
        (err) => {
          setBusy(false);
          console.error(err);
        },
      );
    } else {
      clear();
    }
  };
  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.isComposing) return;
    const mod = e.metaKey || e.ctrlKey;
    if (o.submitOn === "mod-enter" ? !mod : e.shiftKey) return;
    e.preventDefault();
    submit();
  });
  send.el.addEventListener("click", submit);
  return { el, input, setBusy, focus: () => input.focus(), clear };
}
