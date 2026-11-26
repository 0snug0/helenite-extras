// {{name}}: the app's view. This file only says which pages exist. shell.js (copied from Helenite's Media app, do not
// edit) draws the nav, a status strip and one pane per page; router.js decides which page is current.
// A page is `pages/<id>/index.js` with `export default async function mount(el, ctx)` returning an optional cleanup.
// Pages are imported on first visit, mounted once, then hidden and kept alive, so release timers and listeners in the cleanup.
import { mountShell } from "./shell.js";
import { button, chip, errorState, tabs, toolbar } from "./ui-kit.js";

// Nav buttons, in order. Every id needs an entry in PAGES. "home" is where an unknown page id lands.
const NAV = [["home", "Home"], ["about", "About"]];
// The path is built at runtime so nothing resolves a page before it is asked for.
const page = name => () => import(/* @vite-ignore */ `./pages/${name}/index.js`);
const PAGES = { home: page("home"), about: page("about") };

export default function mount(root, api) {
	return mountShell(root, api, { nav: NAV, pages: PAGES, prefix: "app", parts: { button, chip, errorState, tabs, toolbar } });
}
