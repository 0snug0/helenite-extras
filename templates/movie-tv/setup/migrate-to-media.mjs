#!/usr/bin/env node
// One-time migration of the three old apps' stores and settings into the Media app.
//   node setup/migrate-to-media.mjs <vault> [--dry-run]
// Copies <vault>/.helenite/apps/{home,downloadrr,downloadrr-tv}/store.json into <vault>/.helenite/apps/media/store.json, renaming
// each key to its prefixed name (downloadrr -> "movies:<key>", downloadrr-tv -> "tv:<key>", home -> "home:<key>"). It never
// overwrites a key Media already has, never touches a source file and changes nothing when run twice. It also merges
// <vault>/.helenite/apps/{downloadrr,downloadrr-tv}/settings.json (service URLs, SCRAPE_SCORES) into .../media/settings.json under
// the same names; when both old apps set a key differently, downloadrr's value is kept and the other is reported as skipped.
// API keys live in the keychain and cannot be migrated: set them again on the Settings page.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { MOVIES_KEYS, moviesKeyMap, TV_KEYS, tvKeyMap, HOME_KEYS, homeKeyMap } from "../Apps/Media/core/migrate-keys.js";

const SOURCES = [
	{ app: "home", keys: HOME_KEYS, map: homeKeyMap },
	{ app: "downloadrr", keys: MOVIES_KEYS, map: moviesKeyMap },
	{ app: "downloadrr-tv", keys: TV_KEYS, map: tvKeyMap },
];

const dataFile = (vaultDir, app, name) => path.join(vaultDir, ".helenite", "apps", app, name);
// The settings Media declares (app.md). They keep their names; any other key in an old settings.json is not Media's.
const SETTING_KEYS = ["RADARR_URL", "SONARR_URL", "SABNZBD_URL", "PLEX_URL", "TMDB_URL", "SCRAPE_SCORES"];
const SETTING_SOURCES = ["downloadrr", "downloadrr-tv"];   // in this order: when both carry a key with different values, downloadrr's is kept

// Reads a JSON object file: { value } (a missing file is { value: null }) or { error }.
function readObject(file, what) {
	if (!fs.existsSync(file)) return { value: null };
	let v;
	try { v = JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { return { error: `${what} could not be parsed (${e.message})` }; }
	if (!v || typeof v !== "object" || Array.isArray(v)) return { error: `${what} is not an object` };
	return { value: v };
}

// Atomic: written next to the target, then renamed over it.
function writeObject(file, obj) {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	const tmp = `${file}.tmp-${process.pid}`;
	fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
	fs.renameSync(tmp, file);
}

function migrateStores({ vaultDir, dryRun, copied, skipped, errors }) {
	const target = dataFile(vaultDir, "media", "store.json");
	const cur = readObject(target, "media: store.json");
	if (cur.error) { errors.push(`${cur.error.replace("could not be parsed", "is unreadable")}; store not migrated`); return; }
	const next = { ...(cur.value || {}) };
	let changed = false;
	for (const { app, keys, map } of SOURCES) {
		const file = dataFile(vaultDir, app, "store.json");
		if (!fs.existsSync(file)) { skipped.push(`no store for ${app}`); continue; }
		const src = readObject(file, `${app}: store.json`);
		if (src.error) { errors.push(src.error); continue; }
		const names = map();
		for (const [key, value] of Object.entries(src.value)) {
			if (!keys.includes(key)) { skipped.push(`${app}:${key} (unmapped key)`); continue; }
			const to = names[key];
			if (Object.prototype.hasOwnProperty.call(next, to)) { skipped.push(`${to} (media already has it)`); continue; }
			next[to] = value;
			copied.push(to);
			changed = true;
		}
	}
	if (!dryRun && changed) writeObject(target, next);
}

// settings.json: the same file name in the same place (.helenite/apps/<id>/settings.json, flat { NAME: value }), merged the same way.
function migrateSettings({ vaultDir, dryRun, copied, skipped, errors }) {
	const target = dataFile(vaultDir, "media", "settings.json");
	const cur = readObject(target, "media: settings.json");
	if (cur.error) { errors.push(`${cur.error.replace("could not be parsed", "is unreadable")}; settings not migrated`); return; }
	const existing = cur.value || {};
	const next = { ...existing };
	const from = {};   // key -> the old app whose value this run took
	let changed = false;
	for (const app of SETTING_SOURCES) {
		const src = readObject(dataFile(vaultDir, app, "settings.json"), `${app}: settings.json`);
		if (src.error) { errors.push(src.error); continue; }
		if (!src.value) continue;
		for (const [key, value] of Object.entries(src.value)) {
			if (!SETTING_KEYS.includes(key)) { skipped.push(`${app}:${key} (unknown setting)`); continue; }
			if (Object.prototype.hasOwnProperty.call(existing, key)) { skipped.push(`${key} (media already has it)`); continue; }
			if (Object.prototype.hasOwnProperty.call(next, key)) {
				const same = JSON.stringify(next[key]) === JSON.stringify(value);
				skipped.push(`${app}:${key} (${same ? "same as" : "differs from, so"} ${from[key]}'s value, which is kept)`);
				continue;
			}
			next[key] = value;
			from[key] = app;
			copied.push(`settings:${key}`);
			changed = true;
		}
	}
	if (!dryRun && changed) writeObject(target, next);
}

export function migrate({ vaultDir, dryRun = false }) {
	const ctx = { vaultDir, dryRun, copied: [], skipped: [], errors: [] };
	migrateStores(ctx);
	migrateSettings(ctx);
	return { copied: ctx.copied, skipped: ctx.skipped, errors: ctx.errors };
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
	const args = process.argv.slice(2);
	const dryRun = args.includes("--dry-run");
	const usage = "usage: node setup/migrate-to-media.mjs <vault> [--dry-run]";
	const vaultDir = args.find(a => !a.startsWith("-"));
	if (!vaultDir || args.some(a => a.startsWith("-") && a !== "--dry-run")) { console.error(usage); process.exit(2); }
	if (!fs.existsSync(path.join(vaultDir, ".helenite"))) { console.error(`${vaultDir} is not a Helenite vault (no .helenite folder)`); process.exit(2); }
	const r = migrate({ vaultDir: path.resolve(vaultDir), dryRun });
	for (const k of ["copied", "skipped", "errors"]) { console.log(`${k} (${r[k].length}):`); for (const l of r[k]) console.log(`  ${l}`); }
	if (dryRun) console.log("(dry run: nothing written)");
	process.exit(r.errors.length ? 1 : 0);
}
