/**
 * Host-rendered UI, reached through the capability bridge.
 *
 * A sandboxed frame is only as big as its content and cannot draw over the host window, so modals,
 * menus and notices are drawn by the HOST in a top-layer frame. The app sends a declarative spec
 * and gets the user's answer back. This file is the contract with Session R's capability API;
 * `HostUi` mirrors `api.ui.*` and `api.secrets.prompt`. Until R lands, `setBridge` takes any object
 * of this shape, and `inlineBridge` is a DOM fallback (tests, and a dev preview outside the host).
 */
import type { Field } from "@helenite/ui";
export type { Field } from "@helenite/ui";

export type Block = { text: string } | { code: string } | { list: string[] };

export interface ModalAction { id: string; label: string; primary?: boolean; danger?: boolean }
export interface ModalSpec { title: string; body?: Block[]; fields?: Field[]; actions?: ModalAction[]; width?: "narrow" | "normal" | "wide" }
/** `action` is the clicked action id, or `null` when dismissed (Escape, backdrop). */
export interface ModalResult { action: string | null; values: Record<string, string | boolean> }

export interface MenuItem { id?: string; label?: string; icon?: string; danger?: boolean; disabled?: boolean; separator?: boolean }
export interface MenuSpec { items: MenuItem[]; /** Client coordinates inside the frame; the host translates them. */ at?: { x: number; y: number } }

export type NoticeKind = "info" | "success" | "error";

export interface HostUi {
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

export function setBridge(api: KitApi | null): void { current = api; }
export function getBridge(): KitApi {
  if (!current) throw new Error("ui-kit: no host bridge. Call setBridge(api) with the app's capability api first.");
  return current;
}

export const modal = (spec: ModalSpec) => getBridge().ui.modal(spec);
export const notice = (text: string, opts?: { kind?: NoticeKind; timeoutMs?: number }) => { void getBridge().ui.notice(text, opts); };

type Values = Record<string, string | boolean>;

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
export type MenuItemSpec =
  | { title: string; icon?: string; danger?: boolean; disabled?: boolean; onClick: () => unknown }
  | "separator";

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

/** Opens the host's secret dialog. The value goes host → main → keychain and never enters the frame. */
export function promptSecret(name: string): Promise<unknown> {
  const api = getBridge();
  if (!api.secrets) throw new Error("ui-kit: this host has no secrets.prompt");
  return api.secrets.prompt(name);
}

export function openUrl(url: string): void { getBridge().workspace?.openUrl(url); }
