// Media: one multi-page app (Home, Movies, TV, Settings). This file only says which pages exist; shell.js draws the nav,
// the status strip and the panes, and router.js decides which page is current. See shell.js for the page contract.
import { mountShell as mountPages } from "./shell.js";
import { button, chip, errorState, tabs, toolbar } from "./core/ui-kit.js";

const NAV = [["home", "Home"], ["movies", "Movies"], ["tv", "TV"], ["settings", "Settings"]];
// Pages load on first visit. The path is built at runtime so nothing resolves a page before it is asked for.
const page = name => () => import(/* @vite-ignore */ `./pages/${name}/index.js`);
const PAGES = { home: page("home"), movies: page("movies"), tv: page("tv"), settings: page("settings") };

export function mountShell(root, api, pages = PAGES) {
	return mountPages(root, api, { nav: NAV, pages, prefix: "media", parts: { button, chip, errorState, tabs, toolbar } });
}

export default function mount(root, api) {
	return mountShell(root, api);
}
