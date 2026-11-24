// Helenite-only surface of the `obsidian` module, layered over the public typings.
import 'obsidian';

declare module 'obsidian' {
  type Override = 'on' | 'off';
  interface Enablement {
    on: boolean;
    reason: 'locked' | 'global-on' | 'global-off' | 'vault-on' | 'vault-off' | 'not-allowed';
    locked: boolean;
    override: Override | null;
    globalDefault: boolean;
    /** False only in a vault Home's policy does not allow. */
    allowed: boolean;
  }
  interface MatrixCell {
    on: boolean;
    override: Override | null;
    ownSettings: boolean;
    reason: Enablement['reason'];
    /** The manifest's version that applies in that vault; its `source` is 'vault' when a local copy shadows a Home plugin. */
    version: string;
    source: 'core' | 'home' | 'vault';
    /** Vault-local copies only: the vault lists the id in its own community-plugins.json, so it is on whatever Home says. */
    listed?: boolean;
  }
  interface MatrixRow {
    id: string;
    name: string;
    /** 'vault': a plugin that lives only in one vault (one row each, a cell for that vault alone). */
    kind: 'core' | 'home' | 'vault';
    source: 'core' | 'home' | 'vault';
    version: string;
    locked: boolean;
    globalDefault: boolean;
    policy: { home: boolean; vaults: 'all-on' | 'all-off' | 'none' | { only: string[] } | { except: string[] } };
    cells: Record<string, MatrixCell>;
  }
  interface PluginMatrix {
    vaults: { id: string; name: string }[];
    plugins: MatrixRow[];
    /** Home's plugin access file can't be read: plugins follow their previous settings until one is changed. */
    policyUnreadable?: boolean;
  }
  interface Command {
    id: string;
    name: string;
  }

  class HotkeyManager {
    constructor(app: App);
    customKeys: Record<string, Hotkey[]>;
    defaultKeys: Record<string, Hotkey[]>;
    /** Called with the command whose custom keys changed. */
    onChange: ((id: string) => void) | null;
    getHotkeys(id: string): Hotkey[] | undefined;
    getDefaultHotkeys(id: string): Hotkey[] | undefined;
    getEffectiveHotkeys(id: string): Hotkey[];
    addDefaultHotkeys(id: string, keys: Hotkey[]): void;
    removeDefaultHotkeys(id: string): void;
    setHotkeys(id: string, keys: Hotkey[]): void;
    removeHotkeys(id: string): void;
    printHotkeyForCommand(id: string): string;
  }

  interface SettingTab {
    id: string;
    name: string;
  }

  function formatHotkey(hk: Hotkey, mac?: boolean): string;
  function hotkeyId(hk: Hotkey): string;

  interface Keymap {
    isAppHotkey(evt: KeyboardEvent): boolean;
  }

  interface FileManager {
    createNewMarkdownFileFromLinktext(linktext: string, sourcePath: string): Promise<TFile>;
    createNewMarkdownFile(folder?: TFolder | null, name?: string, content?: string): Promise<TFile>;
    createNewFolder(folder?: TFolder | null): Promise<TFolder>;
    renameFile(file: TAbstractFile, newPath: string): Promise<void>;
  }

  interface Vault {
    configDir: string;
    getConfig(key: string): any;
    setConfig(key: string, value: any): void;
  }

  interface PluginManifestScope {
    getScope?(id: string): 'core' | 'global' | 'vault';
  }

  interface App {
    commands: {
      commands: Record<string, Command>;
      findCommand(id: string): Command | undefined;
      executeCommandById(id: string, evt?: Event): boolean;
      listCommands(): Command[];
      addCommand(cmd: Command): Command;
      removeCommand(id: string): void;
    };
    hotkeyManager: HotkeyManager;
    keymap: Keymap;
    setting: {
      open(): void;
      close(): void;
      openTabById(id: string): unknown;
      /** A drill-in page over the active tab with a Back button; `render` fills its body. */
      openSubpage(title: string, render: (el: HTMLElement) => void): void;
      closeSubpage(): void;
      addSettingTab(tab: PluginSettingTab): void;
      removeSettingTab(tab: PluginSettingTab): void;
      addCoreSettingTab(tab: PluginSettingTab): void;
      removeCoreSettingTab(tab: PluginSettingTab): void;
    };
    plugins: {
      manifests: Record<string, PluginManifest>;
      enabledPlugins: Set<string>;
      getPlugin(id: string): any;
      isEnabled(id: string): boolean;
      enablePluginAndSave(id: string): Promise<boolean>;
      disablePluginAndSave(id: string): Promise<void>;
      getScope?(id: string): 'core' | 'global' | 'vault';
      readonly inVault: boolean;
      /** Per plugin, the keys this start's settings migration left only in data.json.bak; empty on later starts. */
      readonly migrationNotes: Readonly<Record<string, readonly string[]>>;
      getEnablement(id: string): Enablement | null;
      /** Home only (rejects in a vault with "Change this in Home"): sets Home's own on/off. Resolves true when applied, false only when the trust gate refused (nothing saved). Read the resulting state from getEnablement. */
      setGlobalEnabled(id: string, on: boolean): Promise<boolean>;
      /** Home only (rejects in a vault): writes the plugin's policy; main first pins the `keepOn` vaults (registry ids) that would lose it. Resolves main's pin result when applied (`failed`: vaults it could not keep on), false only when the trust gate refused (nothing saved). */
      setPolicy(id: string, policy: MatrixRow['policy'], keepOn?: string[]): Promise<{ pinned: number; failed: string[] } | false>;
      /** Same contract as setGlobalEnabled; rejects in Home. */
      setVaultOverride(id: string, value: Override | null): Promise<boolean>;
      /** What the host draws around the plugin's settings page; null when it draws nothing. */
      getSettingsView(id: string):
        | { where: 'home'; bar: true; editingDefaults: boolean; rows: { key: string; label: string; home: unknown; defaults: unknown }[] }
        | { where: 'vault'; tagged: true; entries: ({ key: string; label: string; state: 'default' | 'vault'; value: unknown } | { key: string; label: string; state: 'tied' })[] }
        | { where: 'vault'; tagged: false; separate: boolean }
        | null;
      /** In a vault: the key follows the Default again. Reloads the plugin. */
      resetSetting(id: string, key: string): Promise<void>;
      setSeparateSettings(id: string, on: boolean): Promise<void>;
      isEditingDefaults(id: string): boolean;
      /** Home only: the plugin's page edits its Vault Defaults (on) or Home's value (off). Reloads the plugin. */
      setEditingDefaults(id: string, on: boolean): Promise<void>;
    };
    customCss: {
      theme: string;
      enabledSnippets: Set<string>;
      setTheme(name: string): void;
      setCssEnabledStatus(snippet: string, enabled: boolean): void;
      requestLoadSnippets(): void;
      requestLoadTheme(): void;
      /** Re-reads appearance.json (own over the Vault Defaults) and applies it; writes nothing. */
      load(): Promise<void>;
    };
    isDarkMode(): boolean;
  }
}

declare module 'obsidian' {
  interface FileManager {
    trashFile(file: TAbstractFile): Promise<void>;
  }
  interface ItemView {
    navigation: boolean;
  }
}

declare module 'obsidian' {
  interface WorkspaceRibbon {
    addSettingsButton(icon: string, title: string, cb: (evt: MouseEvent) => void): HTMLElement;
  }
  interface Vault {
    getName(): string;
  }
  interface DataAdapter {
    getBasePath?(): string;
  }
}

declare module 'obsidian' {
  interface Vault {
    readConfigJson?(name: string): Promise<any>;
    /** The Default for the key (Vault Default, else built-in), ignoring this vault's own value. */
    getDefaultConfig(key: string): unknown;
    /** True when this vault stores its own value; false means it follows the Default. */
    isConfigExplicit(key: string): boolean;
    /** Writes the keys changed through setConfig now, instead of after the save debounce. */
    saveConfig(): Promise<void>;
    /** Home's `helenite-defaults/<name>.json`; `{}` in Home itself, or when missing or unparsable. */
    readDefaultsFile(name: string): Record<string, unknown>;
  }
}

declare global {
  /** A staged vault template's manifest (mirrors `TemplateManifest` in `@helenite/harnesses/vault-template`). */
  interface HeleniteTemplateManifest {
    name: string;
    description: string;
    version: string;
    minHelenite?: string;
    setup: string;
    data: Record<string, string>;
    asks: string[];
  }

  /** What an Obsidian vault would bring over (mirrors `ObsidianScan` in the desktop main process). */
  interface HeleniteObsidianScan {
    dir: string;
    plugins: { id: string; name: string; status: 'works' | 'needs-helenite' | 'missing' }[];
    theme: string | null;
    importable: { views: number; envFiles: number; jobs: number };
    error: string | null;
  }

  /** `window.helenite.home`, from the desktop preload. */
  interface HeleniteHomeApi {
    settings(): Promise<import('@helenite/harnesses').HomeSettings>;
    /** Home only. */
    setSettings(patch: Partial<import('@helenite/harnesses').HomeSettings>): Promise<import('@helenite/harnesses').HomeSettings>;
    setup(): Promise<import('@helenite/harnesses').SetupState>;
    /** Home only. */
    saveSetup(s: import('@helenite/harnesses').SetupState): Promise<void>;
    /** Home only. */
    completeSetup(): Promise<void>;
    /** The error text to show, or null when the vault can be created. */
    validateVault(v: import('@helenite/harnesses').NewVault): Promise<string | null>;
    /** Creates and opens the vault, then launches the default harness in it. */
    createVault(v: import('@helenite/harnesses').NewVault): Promise<{ id: string; name: string; root: string; isHome: boolean }[]>;
    /** Clones a template repo into staging. Resolves `{ error }` rather than rejecting. */
    stageTemplate(url: string): Promise<{ token: string; manifest: HeleniteTemplateManifest } | { error: string }>;
    /** Drops a staged template and its files. */
    discardTemplate(token: string): Promise<void>;
    /** Native folder dialog; the chosen path, or null when cancelled. */
    pickObsidianVault(): Promise<string | null>;
    /** Native folder dialog for Open a vault; the chosen path, or null when cancelled. */
    pickFolder(): Promise<string | null>;
    /** Reads an Obsidian vault without changing it; `error` is set when it can't be converted. */
    scanObsidian(dir: string): Promise<HeleniteObsidianScan>;
    /** The local model's read of the plugins that need a Helenite version, by plugin id; empty when no model answers. */
    hintObsidian?(dir: string): Promise<Record<string, { kind: 'cosmetic' | 'builtin'; why: string }>>;
  }

  /** `window.helenite.localLlm`, from the desktop preload: quick decisions from a cheap local model. */
  interface HeleniteLocalLlmApi {
    /** What would answer a decision now, and why not when nothing would. `fresh` looks for runtimes again. */
    status(fresh?: boolean): Promise<import('@helenite/local-llm').LocalLlmStatus>;
    settings(): Promise<import('@helenite/local-llm').LocalLlmSettings>;
    /** Home only. */
    setSettings(patch: Partial<import('@helenite/local-llm').LocalLlmSettings>): Promise<import('@helenite/local-llm').LocalLlmSettings>;
    /** Picks one option. `fallback` answers (source 'fallback') when the model is off, missing, slow, unsure or not allowed by the power rule. */
    decide<T extends string>(req: import('@helenite/local-llm').DecisionRequest<T>): Promise<import('@helenite/local-llm').Decision<T>>;
  }

  /** `window.helenite.settings`, from the desktop preload. */
  interface HeleniteSettingsApi {
    /** Vaults that follow the Default for this key. */
    followers(file: import('@helenite/obsidian-api/settings-layers').DefaultsFile, key: string): Promise<{ id: string; name: string }[]>;
    /** Home only. Pins the `keep` followers to `old`, then writes the Default (value undefined removes it). */
    setDefault(req: { file: import('@helenite/obsidian-api/settings-layers').DefaultsFile; key: string; value: unknown; keep: string[]; old?: unknown }): Promise<{ pinned: number; failed: string[] }>;
    /** Read-only: Home's values, the Vault Defaults and each vault's own values, for `keys` only. In a vault, only that vault unless `all`. */
    matrix(keys: string[], opts?: { all?: boolean }): Promise<{ keys: string[]; home: Record<string, unknown>; defaults: Record<string, unknown>; vaults: { id: string; name: string; own: Record<string, unknown> }[] }>;
  }

  /** `window.helenite.app`, from the desktop preload (the part plugins use). */
  interface HeleniteAppApi {
    version(): Promise<string>;
  }

  /** `window.helenite.harnesses`, from the desktop preload. */
  interface HeleniteHarnessesApi {
    catalog(): Promise<import('@helenite/harnesses').HarnessDef[]>;
    detect(): Promise<import('@helenite/harnesses').DetectedHarness[]>;
    policy(): Promise<import('@helenite/harnesses').HarnessPolicy>;
    /** Harnesses the calling vault may launch. */
    allowed(): Promise<import('@helenite/harnesses').HarnessDef[]>;
    /** Asks Home to allow a vault-defined harness; it waits for approval. */
    request(def: import('@helenite/harnesses').HarnessDef): Promise<void>;
    /** Home only: rejects with "Only Home can change harnesses" elsewhere. */
    setPolicy(p: import('@helenite/harnesses').HarnessPolicy): Promise<void>;
    approve(id: string, scope: import('@helenite/harnesses').HarnessScope): Promise<void>;
    deny(id: string): Promise<void>;
    onChange(cb: () => void): () => void;
    /** Home created this vault: launch the default harness. `sessionNote` false means a plain tab, never a session note. */
    onLaunchDefault(cb: (o: { sessionNote: boolean; prompt?: string }) => void): () => void;
  }
}

// `Plugin.registerAccountType` for core plugins that are typechecked against the real `obsidian` types (mirrors `AccountTypeDef` in `@helenite/obsidian-api/accounts`).
declare module 'obsidian' {
  interface Plugin {
    registerAccountType(def: {
      type: string;
      name?: string;
      description?: string;
      /** Icon id for setIcon: a Lucide name, or one added with addIcon (e.g. a logo). */
      icon?: string;
      connect(el: HTMLElement, ctx: { accountId?: string; save(input: any): Promise<any>; api?: any; done(account?: any): void }): void | (() => void);
      methods?: Record<string, (account: any, ctx: any, args: any) => unknown | Promise<unknown>>;
      renderAccount?(account: any, ctx: { header: Setting; block: HTMLElement; api: any; redraw(): void; run(fn: () => Promise<unknown>): Promise<void> }): void | false;
      remove?(account: any, ctx: { api: any; redraw(): void; run(fn: () => Promise<unknown>): Promise<void> }): void | Promise<void>;
    }): void;
  }
}
