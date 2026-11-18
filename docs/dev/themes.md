# Themes

Helenite loads Obsidian themes and CSS snippets. A theme written for Obsidian works, and a theme written for Helenite can also style the design-system parts and vault apps.

Start from the template: `node packages/create-helenite/bin.mjs my-theme --template theme --name "My Theme"`. It writes `manifest.json` and a `theme.css` that sets Obsidian's variables for light and dark, sets the `--hel-*` variables, and lists the public classes.

## Where themes and snippets live

| What | Where |
| --- | --- |
| A theme | `<config>/themes/<Theme name>/theme.css`, with `manifest.json` (`name`, `version`, `author`) beside it |
| A snippet | `<config>/snippets/<name>.css` |

`<config>` is `~/.helenite/.obsidian` for Home and `<vault>/.helenite` for a vault. When it loads the chosen theme and snippets, Helenite looks in the vault's folder first, then in Home's, so a theme or snippet installed in Home works in every vault.

Pick a theme under **Themes** in Settings, **Appearance**, and turn snippets on in the same tab. That tab lists only the window's own `themes` and `snippets` folders: a vault's Appearance shows what is in `<vault>/.helenite`, not Home's. To use a theme installed in Home, pick it in Home's Appearance, for Home or for the Vault Defaults that vaults follow. The choice is saved in `appearance.json` (`cssTheme`, `enabledCssSnippets`); a vault's `appearance.json` overrides Home's Vault Defaults key by key. Edits to `appearance.json` apply at once. Edits to `theme.css` do not: pick another theme and back, or restart. The loader is `packages/obsidian-api/src/custom-css.ts`.

## The cascade

In the app, later wins:

1. Helenite's base theme (Obsidian's variables and classes, and the design-system parts' CSS in `06-design-system.css`)
2. Plugins' `styles.css`
3. The theme (`<style id="css-theme">`)
4. Enabled snippets (`<style id="css-snippets">`)

So a theme rule beats the defaults at the same specificity, and a snippet beats the theme.

## Light and dark

The body has `theme-light` or `theme-dark`, from "Base color scheme" in Settings, Appearance (Light, Dark, or Adapt to system). Put scheme colours under those classes:

```css
.theme-light { --accent-h: 262; --accent-s: 60%; --accent-l: 55%; --background-primary: #fdfcff; }
.theme-dark  { --accent-h: 262; --accent-s: 70%; --accent-l: 70%; --background-primary: #1b1822; }
```

`--accent-h`, `--accent-s` and `--accent-l` are the accent colour that `--interactive-accent`, links and toggles derive from.

## Variables

Change variables before classes. The design-system parts use only Obsidian's documented variables (`--text-muted`, `--interactive-accent`, `--size-4-2` and so on), so a theme's Obsidian variables already restyle them. Where Obsidian has no variable, a part uses a `--hel-*` one, whose default is an Obsidian variable:

```css
body {
  --hel-segment-active-bg: var(--color-purple);
  --hel-segment-active-fg: var(--background-primary);
}
```

Declare `--hel-*` variables on `body` (or a descendant), never on `:root`: they refer to theme variables that are defined on `body`, so on `:root` they resolve to nothing. The full list is under "Variables" in [STYLING.md](../design-system/STYLING.md#variables).

## Public classes

Every part's root element has a `hel-<part>` class, variants and states are `is-<variant>` and `is-<state>`, and where Obsidian has a class for the same thing the part carries it too (`mod-cta`, `mod-warning`, `clickable-icon`, `setting-item`, `callout`, `dropdown`, `checkbox-container`, `modal-button-container`, `nav-header`), so a theme's Obsidian styles keep applying. Every class is listed, with what it is, in [STYLING.md](../design-system/STYLING.md).

```css
.hel-badge { border-radius: 0; }
.hel-button.is-link { text-decoration: underline; }
```

Select by the `hel-` class and an `is-` variant. Do not select by Obsidian's class alone: `.mod-cta` matches every Obsidian button, not just Helenite's.

## Previewing

Open Settings, **Design system** (in Home). It draws every part in the current theme, so one page shows the effect of your variables and class rules on all of them. Switch "Base color scheme" to check light and dark.

To compare screenshots before and after a change, see [testing.md](./testing.md#screenshots).

## What reaches vault apps

A vault app runs in a sandboxed frame with its own document. The frame loads, in order: the app base stylesheet, the design-system stylesheet, the app's `view.css`, then the theme and the enabled snippets. The host's resolved theme variables are set on the frame's `body`, so the app's variables match the host exactly. When the user changes the theme or a snippet, open app frames update.

- An app with `theme: inherit` (the default in `app.md`) gets all of that, so your `.hel-*` rules restyle its parts too.
- An app with `theme: isolate` gets the variables and the design-system stylesheet, but not the theme's or the snippets' own CSS.

The frame's page background always stays transparent, whatever a theme paints on `html` or `body`. Forwarding does not widen an app's access: its content security policy still blocks network fonts and images (`font-src` allows `data:` only), so a theme that loads a web font works in the host but not inside apps.
