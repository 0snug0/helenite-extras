// The plugin's saved data (data.json) and its defaults. Plain TypeScript with no `obsidian` or `helenite` imports,
// so test/settings.test.ts can run it under plain Node.

export interface Greeting {
  id: string;
  text: string;
}

export interface Settings {
  helloOnStart: boolean;
  greetings: Greeting[];
}

/** The plugin's name, as in manifest.json. */
export const PLUGIN_NAME = {{nameJs}};

export const DEFAULT_SETTINGS: Settings = {
  helloOnStart: false,
  greetings: [{ id: 'hello', text: `Hello from ${PLUGIN_NAME}!` }],
};

/** What `loadData()` returned (null on the first run), with every missing setting filled in from the defaults. */
export function withDefaults(saved: unknown): Settings {
  const s = (saved !== null && typeof saved === 'object' ? saved : {}) as Partial<Settings>;
  return {
    helloOnStart: typeof s.helloOnStart === 'boolean' ? s.helloOnStart : DEFAULT_SETTINGS.helloOnStart,
    greetings: Array.isArray(s.greetings) ? s.greetings : DEFAULT_SETTINGS.greetings.map((g) => ({ ...g })),
  };
}
