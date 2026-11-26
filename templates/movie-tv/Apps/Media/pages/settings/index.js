// Settings page: the service secrets (status + a Set button that opens the host's own secret dialog), the service URLs and the
// service health. `export default` is a PageMount: (el, ctx) => cleanup. See ../../view.js for ctx.
//
// Secrets: api.secrets.status() says which are set (never the value); api.secrets.prompt(name) makes the host draw the entry
// dialog and store the value in the keychain. Settings: api.settings is read-only to an app and the host has no settings editor
// for apps, so the URLs are shown as they are, with a pointer to the file the host reads them from.
// Why the other pages may be in a setup state: Movies needs the Radarr key, TV the Sonarr key; each says so itself.
import { createServices } from "../../core/services.js";
import { button, callout, card, field, keyValue, sectionHeading, setBridge, statusText } from "../../core/ui-kit.js";

export const SECRETS = [
	["RADARR_API_KEY", "Radarr API key", "required by Movies"],
	["SONARR_API_KEY", "Sonarr API key", "required by TV"],
	["SABNZBD_API_KEY", "SABnzbd API key", "download progress"],
	["PLEX_TOKEN", "Plex token", "watch state"],
	["TMDB_TOKEN", "TMDB read token", "streaming availability"],
	["OMDB_API_KEY", "OMDb API key", "ratings"],
];
export const URLS = [
	["RADARR_URL", "Radarr URL"], ["SONARR_URL", "Sonarr URL"], ["SABNZBD_URL", "SABnzbd URL"], ["PLEX_URL", "Plex URL"],
	["TMDB_URL", "TMDB API URL"], ["SCRAPE_SCORES", "Scrape Letterboxd and Rotten Tomatoes scores"],
];
const SERVICE_OF = { RADARR_API_KEY: "radarr", SONARR_API_KEY: "sonarr", SABNZBD_API_KEY: "sabnzbd", PLEX_TOKEN: "plex", TMDB_TOKEN: "tmdb" };

export default async function mount(host, ctx) {
	const { api } = ctx;
	setBridge(api);
	let alive = true;
	const root = host.createDiv({ cls: "media-settings" });
	sectionHeading(root, { title: "Settings", level: 1 });
	callout(root, { text: "Movies needs the Radarr key and TV the Sonarr key. Until it is set, that page shows a setup state instead of its list. The Radarr and Sonarr keys take effect as soon as they are set: open the page and it starts. The SABnzbd, Plex, TMDB and OMDb keys are read when a page starts, so they take effect the next time Media is opened (close its tab and open it again)." }).el.classList.add("media-settings-why");

	const secrets = card(root, { title: "Secrets" });
	statusText(secrets.body, "Keys are kept in the system keychain. They can be set or replaced here, never read back.");
	const list = secrets.body.createDiv();

	const services = card(root, { title: "Services" });
	const s = api.settings ?? {};
	const urls = keyValue(services.body, URLS.map(([key, label]) => ({ key: label, value: String(s[key] ?? "") })));
	URLS.forEach(([key], i) => { const row = urls.children[i]; row.classList.add("media-settings-url"); row.dataset.setting = key; });
	statusText(services.body, "Read-only here: an app cannot change its own settings. To change one, edit .helenite/apps/media/settings.json in the vault (the file Helenite reads app settings from) and reopen the app.");

	let health = {};
	const errors = new Map();   // secret name -> message of its last failed prompt, cleared on the next attempt
	async function paint() {
		let have = {};
		try { have = (await api.secrets.status()) ?? {}; } catch { have = {}; }
		if (!alive) return;
		list.replaceChildren();
		for (const [name, label, note] of SECRETS) {
			const set = !!have[name];
			const unreachable = SERVICE_OF[name] && set && health[SERVICE_OF[name]] === "down";
			const row = field(list, { label, hint: note });
			row.el.classList.add("media-settings-secret", set ? "is-set" : "is-missing");
			row.el.dataset.secret = name;
			statusText(row.control, unreachable ? "set, service unreachable" : set ? "set" : "not set", unreachable ? "warning" : set ? "success" : "default");
			button(row.control, { text: set ? "Replace" : "Set", onClick: async () => {
				errors.delete(name);
				try { await api.secrets.prompt(name); } catch (e) { errors.set(name, (e && e.message) || String(e)); }   // a cancel resolves false: silent
				if (!alive) return;
				await paint();
				if (!errors.has(name)) checkHealth();
			} });
			if (errors.has(name)) {
				row.setError(`Could not set: ${errors.get(name)}`);
				row.el.querySelector(".hel-field-error").classList.add("media-settings-error");
			}
		}
	}
	async function checkHealth() {
		try {
			health = (await createServices(api).status()) ?? {};
		} catch { health = {}; }
		if (!alive) return;
		for (const [service, state] of Object.entries(health)) ctx.setStatus(service, state);
	}

	await paint();
	checkHealth().then(() => alive && paint());
	return () => { alive = false; root.remove(); };
}
