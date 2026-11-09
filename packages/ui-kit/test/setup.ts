import { afterEach, beforeEach } from "vitest";
import { setBridge, type HostUi, type KitApi, type ModalSpec, type ModalResult, type MenuSpec } from "../src";

/** A recording fake of the host's ui capability. */
export function fakeHost(answers: { modal?: ModalResult; menu?: string | null } = {}) {
  const calls = { modal: [] as ModalSpec[], menu: [] as MenuSpec[], notice: [] as [string, any][], secrets: [] as string[], urls: [] as string[] };
  const ui: HostUi = {
    modal: async (s) => { calls.modal.push(s); return answers.modal ?? { action: null, values: {} }; },
    menu: async (s) => { calls.menu.push(s); return answers.menu ?? null; },
    notice: (t, o) => { calls.notice.push([t, o]); },
  };
  const api: KitApi = { ui, secrets: { prompt: async (n) => { calls.secrets.push(n); } }, workspace: { openUrl: (u) => { calls.urls.push(u); }, openNote: () => {} } };
  return { api, calls };
}

beforeEach(() => { document.body.innerHTML = ""; });
afterEach(() => setBridge(null));
