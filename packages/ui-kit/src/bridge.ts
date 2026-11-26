/**
 * Host-rendered UI, reached through the capability bridge.
 *
 * A sandboxed frame is only as big as its content and cannot draw over the host window, so modals,
 * menus and notices are drawn by the HOST in a top-layer frame. The app sends a declarative spec
 * and gets the user's answer back. `HostUi` mirrors the frame's `api.ui.*` and `api.secrets.prompt`;
 * the host validates each spec, labels the modal with the app, and refuses secret fields
 * (packages/apps-runtime/src/host/overlays.ts). `setBridge` takes any object of this shape (tests pass a fake).
 */
import { setMenuRenderer } from "@helenite/ui";
import type { Field, FieldValues, MenuItemSpec } from "@helenite/ui";
export type { Field, FieldValues, MenuItemSpec } from "@helenite/ui";

export type Block = { text: string } | { code: string } | { list: string[] };

export interface ModalAction { id: string; label: string; primary?: boolean; danger?: boolean }
export interface ModalSpec { title: string; body?: Block[]; fields?: Field[]; actions?: ModalAction[]; width?: "narrow" | "normal" | "wide" }
/** `action` is the clicked action id, or `null` when dismissed (Escape, backdrop). */
export interface ModalResult { action: string | null; values: FieldValues }

export interface MenuItem { id?: string; label?: string; icon?: string; danger?: boolean; disabled?: boolean; separator?: boolean }
export interface MenuSpec { items: MenuItem[]; /** Client coordinates inside the frame; the host translates them. */ at?: { x: number; y: number } }

export type NoticeKind = "info" | "success" | "error";

/** One element of a 24x24 stroked icon, as the host sends it. */
export type IconShape = [tag: "path" | "circle" | "line" | "rect" | "ellipse" | "polyline" | "polygon", attrs: Record<string, string>];

export interface HostUi {
  /** The shapes of up to 100 Lucide icons, by name; a name the host does not know is left out. Absent on an older host. */
  icons?(names: string[]): Promise<Record<string, IconShape[]>>;
  modal(spec: ModalSpec): Promise<ModalResult>;
  /** Resolves with the chosen item id, or `null` when dismissed. */
  menu(spec: MenuSpec): Promise<string | null>;
  notice(text: string, opts?: { kind?: NoticeKind; timeoutMs?: number }): void | Promise<void>;
  /** Lifts an embedded frame over the window while the app draws its own overlay (legacy path). */
  overlay?(on: boolean): void | Promise<void>;
}

/** The subset of the capability API the kit uses. */
export interface KitApi {
  ui: HostUi;
  secrets?: { prompt(name: string): Promise<unknown> };
  workspace?: { openUrl(url: string): unknown; openNote(path: string, opts?: { newTab?: boolean }): unknown };
}

let current: KitApi | null = null;

const listeners: (() => void)[] = [];

export function setBridge(api: KitApi | null): void {
  if (api === current) return; // each of an app's pages may call it
  current = api;
  for (const l of listeners) l();
}
/** Runs `fn` each time the bridge changes. */
export function onBridge(fn: () => void): void { listeners.push(fn); }
/** The bridge, or `null` before `setBridge`. */
export function peekBridge(): KitApi | null { return current; }
export function getBridge(): KitApi {
  if (!current) throw new Error("ui-kit: no host bridge. Call setBridge(api) with the app's capability api first.");
  return current;
}

export const modal = (spec: ModalSpec) => getBridge().ui.modal(spec);
export const notice = (text: string, opts?: { kind?: NoticeKind; timeoutMs?: number }) => { void getBridge().ui.notice(text, opts); };

type Values = FieldValues;

/**
 * Overlays: same option objects as the `helenite` module's overlays, minus `app`. They are drawn by the
 * host, so `onClick`-style callbacks stay here and only declarative specs cross the bridge. The primary
 * action is the caller's own verb (never "OK"), with a Cancel before it.
 */
const ACTION = "action";
const actions = (o: { action: string; danger?: boolean; cancel?: string }): ModalAction[] => [
  { id: "cancel", label: o.cancel ?? "Cancel" },
  o.danger ? { id: ACTION, label: o.action, danger: true } : { id: ACTION, label: o.action, primary: true },
];

export interface ConfirmOptions { title: string; message: string; action: string; danger?: boolean; cancel?: string }
export interface PromptOptions { title: string; label?: string; value?: string; placeholder?: string; action: string }
export interface ChooseOptions<T extends string> { title: string; options: { value: T; text: string; detail?: string; disabled?: boolean }[] }
export interface FormOptions { title: string; fields: Field[]; action: string; danger?: boolean }

export async function confirm(o: ConfirmOptions): Promise<boolean> {
  const r = await modal({ title: o.title, body: [{ text: o.message }], actions: actions(o) });
  return r.action === ACTION;
}

/** Asks for a single value (not a secret: use `promptSecret` for those). */
export async function prompt(o: PromptOptions): Promise<string | null> {
  const r = await modal({
    title: o.title,
    fields: [{ id: "v", kind: "text", label: o.label ?? "", value: o.value, placeholder: o.placeholder }],
    actions: actions(o),
  });
  return r.action === ACTION ? String(r.values.v ?? "") : null;
}

/** Picks one option from a list in a host modal. Resolves with its value or `null`. */
export async function choose<T extends string>(o: ChooseOptions<T>): Promise<T | null> {
  const r = await modal({
    title: o.title,
    fields: [{ id: "choice", kind: "choice", options: o.options.map((x) => ({ value: x.value, label: x.text, detail: x.detail, disabled: x.disabled })) }],
    actions: actions({ action: "Select" }),
    width: "wide",
  });
  return r.action === ACTION ? ((String(r.values.choice ?? "") || null) as T | null) : null;
}

export async function form(o: FormOptions): Promise<Values | null> {
  const r = await modal({ title: o.title, fields: o.fields, actions: actions(o) });
  return r.action === ACTION ? r.values : null;
}

/** Shows a context menu at a point inside the frame and runs the chosen item's `onClick`. */
export async function menu(items: MenuItemSpec[], at: { x: number; y: number }): Promise<void> {
  const id = await getBridge().ui.menu({
    items: items.map((it, i): MenuItem => it === "separator"
      ? { separator: true }
      : { id: String(i), label: it.title, icon: it.icon, danger: it.danger, disabled: it.disabled }),
    at,
  });
  const chosen = id == null ? undefined : items[Number(id)];
  if (chosen && chosen !== "separator") await chosen.onClick();
}

// A part's context menu (ui.listRow's `menu`) opens as a host menu through the bridge.
setMenuRenderer((items, at) => {
  menu(items, "clientX" in at ? { x: at.clientX, y: at.clientY } : at).catch((err) => console.error(err));
});

/** Opens the host's secret dialog. The value goes host → main → keychain and never enters the frame. */
export function promptSecret(name: string): Promise<unknown> {
  const api = getBridge();
  if (!api.secrets) throw new Error("ui-kit: this host has no secrets.prompt");
  return api.secrets.prompt(name);
}

export function openUrl(url: string): void { getBridge().workspace?.openUrl(url); }
