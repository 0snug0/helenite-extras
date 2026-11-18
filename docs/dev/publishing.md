# Publishing

Helenite has no plugin, theme or app directory yet, and none of its packages is on npm. Sharing today means sharing the folder.

## A plugin

Share the built `dist/` folder (`main.js`, `manifest.json`, and `styles.css` if you have one), for example as a zip or a release asset in your repository. The person installing it unpacks it into a plugins folder named after the id and restarts Helenite:

- `~/.helenite/.obsidian/plugins/<id>/` for Home, or
- `<vault>/.helenite/plugins/<id>/` for one vault,

then turns it on in Settings, Community plugins.

Before you share it:

- Bump `version` in `manifest.json` (and `package.json`). Helenite shows the version in Settings, and the full-access warning for a plugin without `permissions` comes back once per version.
- Set the `helenite` range to the versions you tested ([plugins.md](./plugins.md#the-helenite-range)). A Helenite outside the range refuses the plugin with a notice instead of loading something that may break.
- Declare `permissions` if the plugin only needs a few, so users see what it asks for ([plugins.md](./plugins.md#permissions)).
- The template's build inlines a source map (`sourcemap: 'inline'` in `build.mjs`). Turn it off for a smaller `main.js` if you prefer.

A plugin that guards its `require('helenite')` ([plugins.md](./plugins.md#running-in-obsidian-too)) is also an Obsidian plugin, and can go through Obsidian's own community plugin process.

## A theme

Share the theme's folder (`manifest.json` and `theme.css`). It installs into `~/.helenite/.obsidian/themes/<Theme name>/` or `<vault>/.helenite/themes/<Theme name>/`, and in Obsidian into `<vault>/.obsidian/themes/<Theme name>/`. The folder's name is what Settings, Appearance lists.

## A vault app

Share the app's folder (`app.md`, `view.js`, `view.css`, `ui-kit.js` and anything else it imports). It installs into `<vault>/Apps/<Name>/`. The user approves its permissions when it first opens, so declare only what it uses.

## The packages

`@helenite/types`, `@helenite/ui-kit` and `create-helenite` are private workspace packages: they are not published to npm, and there is no `npm install` for them. That is deliberate for now; publishing them is a decision for the Helenite maintainers.

- The scaffolder runs from a checkout: `node packages/create-helenite/bin.mjs`. It copies what a project needs (the types, or the ui-kit bundle) into the project, so the project builds on its own afterwards.
- To give someone the scaffolder without a checkout, pack it: `pnpm --dir packages/create-helenite pack`. Packing first saves the types and the ui-kit bundle into the package (`vendor/`), so the tarball works on its own: `npm exec --package=./create-helenite-0.1.0.tgz -- create-helenite my-plugin --template plugin`.
