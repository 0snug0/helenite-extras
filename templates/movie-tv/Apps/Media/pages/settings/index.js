// Settings page: the service secrets (status + a Set button that opens the host's own secret dialog), the service URLs and the
// service health. `export default` is a PageMount: (el, ctx) => cleanup. See ../../view.js for ctx.
//
// Secrets: api.secrets.status() says which are set (never the value); api.secrets.prompt(name) makes the host draw the entry
// dialog and store the value in the keychain. Settings: api.settings is read-only to an app and the host has no settings editor
// for apps, so the URLs are shown as they are, with a pointer to the file the host reads them from.
// Why the other pages may be in a setup state: Movies needs the Radarr key, TV the Sonarr key; each says so itself.
import { createServices } from "../../core/services.js";

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
	const doc = host.ownerDocument;
	const h = (parent, tag, cls, text) => {
		const e = doc.createElement(tag);
		if (cls) e.className = cls;
		if (text != null) e.textContent = text;
		parent.appendChild(e);
		return e;
	};
	let alive = true;
	const root = h(host, "div", "media-settings");
	h(root, "h2", "media-settings-title", "Settings");
	h(root, "p", "media-settings-why", "Movies needs the Radarr key and TV the Sonarr key. Until it is set, that page shows a setup state instead of its list. Set a key here, then open the page again.");

	const secretsBox = h(root, "section", "media-settings-secrets");
	h(secretsBox, "h3", null, "Secrets");
	h(secretsBox, "p", "media-settings-hint", "Keys are kept in the system keychain. They can be set or replaced here, never read back.");
	const list = h(secretsBox, "div", "media-settings-list");

	const urlBox = h(root, "section", "media-settings-urls");
	h(urlBox, "h3", null, "Services");
	const s = api.settings ?? {};
	for (const [key, label] of URLS) {
		const row = h(urlBox, "div", "media-settings-url");
		row.dataset.setting = key;
		h(row, "span", "media-settings-label", label);
		h(row, "code", "media-settings-value", String(s[key] ?? ""));
	}
	h(urlBox, "p", "media-settings-hint", "Read-only here: an app cannot change its own settings. To change one, edit .helenite/apps/media/settings.json in the vault (the file Helenite reads app settings from) and reopen the app.");

	let health = {};
	const errors = new Map();   // secret name -> message of its last failed prompt, cleared on the next attempt
	async function paint() {
		let have = {};
		try { have = (await api.secrets.status()) ?? {}; } catch { have = {}; }
		if (!alive) return;
		list.replaceChildren();
		for (const [name, label, note] of SECRETS) {
			const set = !!have[name];
			const row = h(list, "div", `media-settings-secret ${set ? "is-set" : "is-missing"}`);
			row.dataset.secret = name;
			const text = h(row, "span", "media-settings-label", label);
			text.title = note;
			h(row, "span", "media-settings-note", note);
			const state = SERVICE_OF[name] && set && health[SERVICE_OF[name]] === "down" ? "set, service unreachable" : set ? "set" : "not set";
			h(row, "span", "media-settings-state", state);
			const b = h(row, "button", "media-settings-set", set ? "Replace" : "Set");
			b.type = "button";
			if (errors.has(name)) h(row, "span", "media-settings-error", `Could not set: ${errors.get(name)}`);
			b.addEventListener("click", async () => {
				errors.delete(name);
				try { await api.secrets.prompt(name); } catch (e) { errors.set(name, (e && e.message) || String(e)); }   // a cancel resolves false: silent
				if (!alive) return;
				await paint();
				if (!errors.has(name)) checkHealth();
			});
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
