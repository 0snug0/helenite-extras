// One icon renderer for the whole app. core/ui-kit.js keeps a single module-global renderer, and every page of the app shares
// that module instance, so a page that installed its own would take the icons away from the page mounted before it.
// Each page calls registerIcons(its own map) instead; the maps merge (a name two pages share must draw the same thing) and the
// one renderer, installed here, looks a name up in the merged map before falling back to ui-kit's standard icons.
import { kitIconRenderer, setIconRenderer } from "./ui-kit.js";

const registry = {};
const render = (el, name) => {
	if (!Object.prototype.hasOwnProperty.call(registry, name)) return kitIconRenderer(el, name);
	el.dataset.icon = name;
	el.innerHTML = registry[name];
};

/** icons: { name: "<svg ...>" }. Safe to call on every mount. */
export function registerIcons(icons) {
	Object.assign(registry, icons);
	setIconRenderer(render);
}
