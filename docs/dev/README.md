# Building for Helenite

Helenite runs Obsidian plugins and themes, and adds its own pieces on top: the `helenite` module of design-system parts, a Home that manages plugins across vaults, and vault apps (sandboxed micro-apps that live in a vault's `Apps` folder). These pages are for developers who know Obsidian plugins and want to build a plugin, a theme or a vault app for Helenite.

Start with [getting-started.md](./getting-started.md): a working plugin in five minutes.

| Page | What it covers |
| --- | --- |
| [getting-started.md](./getting-started.md) | Scaffold, build, install and turn on a plugin. |
| [plugins.md](./plugins.md) | Lifecycle, the manifest and its `helenite` range, settings tabs, commands and the ribbon, data, permissions, running in Obsidian too. |
| [design-system.md](./design-system.md) | The `ui` parts: which one to use for what, and where the reference is. |
| [themes.md](./themes.md) | Variables, public classes, light and dark, snippets, and what reaches vault apps. |
| [vault-apps.md](./vault-apps.md) | `app.md`, views, the capability `api`, `@helenite/ui-kit`, and the sandbox. |
| [testing.md](./testing.md) | Unit tests, the plugin test harness, typechecking against `@helenite/types`, screenshots. |
| [publishing.md](./publishing.md) | Sharing a plugin, theme or app today. |

## The dev kit

- **`packages/create-helenite`**: a scaffolder with three templates.

  ```
  node packages/create-helenite/bin.mjs <dir> --template plugin|theme|app [--name "My thing"] [--id my-thing]
  ```

  It never writes into a folder that is not empty. `--id` defaults to the name made lowercase with hyphens, or to the folder's name. Ids are 2 to 41 lowercase letters, digits and hyphens, starting with a letter; a plugin id may not start with `core-`. A name may hold quotes, backslashes and any Unicode, but no slash or line break, and may not start with a dot.
- **`@helenite/types`** (`packages/types`): the types of the `helenite` module, generated from the runtime module so they cannot drift. The plugin template gets a copy in `types/helenite.d.ts`.
- **`@helenite/ui-kit`** (`packages/ui-kit`): the design-system parts for vault apps. The app template gets a bundle in `ui-kit.js`.
- **The plugin test harness** (`plugins/core-build/test/harness.ts`): loads a built plugin into a real Helenite `App` under vitest and jsdom. See [testing.md](./testing.md).
- **Settings, Design system** (in Home): every part, live, next to the code that draws it.

None of these packages is published to npm. See [publishing.md](./publishing.md).

## Reference

- [docs/design-system/README.md](../design-system/README.md): every `ui` part, its options and its handle.
- [docs/design-system/STYLING.md](../design-system/STYLING.md): every public class and `--hel-*` variable.
- `catalog/plugins/sample-design-system`: a plugin that uses every part with no CSS of its own, with screenshots and a test.
- `catalog/plugins/sample-letterboxd-account`: a plugin that adds an account type (its README explains the contract).
