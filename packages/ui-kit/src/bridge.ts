/**
 * Host-rendered UI, reached through the capability bridge.
 *
 * A sandboxed frame is only as big as its content and cannot draw over the host window, so modals,
 * menus and notices are drawn by the HOST in a top-layer frame. The app sends a declarative spec
 * and gets the user's answer back. This file is the contract with Session R's capability API;
 * `HostUi` mirrors `api.ui.*` and `api.secrets.prompt`. Until R lands, `setBridge` takes any object
 * of this shape, and `inlineBridge` is a DOM fallback (tests, and a dev preview outside the host).
 */
export type Block = { text: string } | { code: string } | { list: string[] };

export type Field =
  | { id: string; kind: "text"; label: string; value?: string; placeholder?: string; secret?: boolean }
  | { id: string; kind: "checkbox"; label: string; value?: boolean }
  | { id: string; kind: "select"; label: string; value?: string; options: { value: string; label: string }[] }
  /** A list of rows to choose one from (a release picker). */
  | { id: string; kind: "choice"; label?: string; value?: string; options: { value: string; label: string; detail?: string; disabled?: boolean }[] };

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
export const menu = (spec: MenuSpec) => getBridge().ui.menu(spec);
export const notice = (text: string, opts?: { kind?: NoticeKind; timeoutMs?: number }) => { void getBridge().ui.notice(text, opts); };

export async function confirm(title: string, message: string, opts: { confirmLabel?: string; danger?: boolean } = {}): Promise<boolean> {
  const r = await modal({
    title,
    body: [{ text: message }],
    actions: [{ id: "cancel", label: "Cancel" }, { id: "ok", label: opts.confirmLabel ?? "OK", primary: !opts.danger, danger: opts.danger }],
  });
  return r.action === "ok";
}

/** Asks the user for a single value (not a secret: use `api.secrets.prompt` for those). */
export async function prompt(title: string, opts: { label?: string; value?: string; placeholder?: string } = {}): Promise<string | null> {
  const r = await modal({
    title,
    fields: [{ id: "v", kind: "text", label: opts.label ?? "", value: opts.value, placeholder: opts.placeholder }],
    actions: [{ id: "cancel", label: "Cancel" }, { id: "ok", label: "OK", primary: true }],
  });
  return r.action === "ok" ? String(r.values.v ?? "") : null;
}

/** Picks one option from a list in a host modal. Resolves with its value or `null`. */
export async function choose(title: string, options: { value: string; label: string; detail?: string; disabled?: boolean }[], opts: { value?: string; confirmLabel?: string } = {}): Promise<string | null> {
  const r = await modal({
    title,
    fields: [{ id: "choice", kind: "choice", value: opts.value, options }],
    actions: [{ id: "cancel", label: "Cancel" }, { id: "ok", label: opts.confirmLabel ?? "Select", primary: true }],
    width: "wide",
  });
  return r.action === "ok" ? String(r.values.choice ?? "") || null : null;
}

/** Opens the host's secret dialog. The value goes host → main → keychain and never enters the frame. */
export function promptSecret(name: string): Promise<unknown> {
  const api = getBridge();
  if (!api.secrets) throw new Error("ui-kit: this host has no secrets.prompt");
  return api.secrets.prompt(name);
}

export function openUrl(url: string): void { getBridge().workspace?.openUrl(url); }
