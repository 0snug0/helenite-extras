# {{name}}

A Helenite theme, made by create-helenite. `theme.css` overrides Obsidian's variables for light and dark, sets Helenite's `--hel-*` variables, and lists the public classes you can restyle.

The full guide is `docs/dev/themes.md` in the Helenite repository; every class and variable is in `docs/design-system/STYLING.md`.

## Install it

A theme is a folder with `manifest.json` and `theme.css`, named after the theme. Copy this folder to one of:

- Home: `~/.helenite/.obsidian/themes/{{name}}/`
- One vault: `<vault>/.helenite/themes/{{name}}/`

Then pick "{{name}}" under Themes in Settings, Appearance, in the same window (Home's or that vault's). The choice is saved in that config folder's `appearance.json` as `"cssTheme": "{{name}}"`. Light or dark follows "Base color scheme" on the same page. When a vault's theme is set to a name, Helenite looks for that folder in the vault's config folder first, then in Home's.

The theme works in Obsidian too: copy the folder to `<vault>/.obsidian/themes/{{name}}/`.

## Preview it

Open Settings, Design system (in Home). It draws every design-system part live, so you can see your variables and class overrides on all of them at once, in light and in dark. Helenite does not reload a theme when you save `theme.css`: pick another theme and pick this one again, or restart.

## Vault apps

Apps that inherit the theme (`theme: inherit`, the default) load `theme.css` in their frame after their own CSS, so your class overrides reach them, and they get your variables. Apps with `theme: isolate` get the variables only.
