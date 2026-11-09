import { fileURLToPath } from 'node:url';

/** Absolute path of `base.css`, for bundlers and the desktop shell to copy or link. */
export const baseCssPath: string = fileURLToPath(new URL('../base.css', import.meta.url));

/** Cascade order the host must follow: base, plugin styles, theme, snippets, Style Settings. */
export const CASCADE_IDS = {
  base: 'helenite-base',
  theme: 'css-theme',
  snippet: 'css-snippet',
  styleSettings: 'css-settings-manager',
} as const;
