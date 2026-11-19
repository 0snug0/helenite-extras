#!/usr/bin/env node
// One-time migration of the three old apps' stores into the Media app's store.
//   node setup/migrate-to-media.mjs <vault> [--dry-run]
// Copies <vault>/.helenite/apps/{home,downloadrr,downloadrr-tv}/store.json into <vault>/.helenite/apps/media/store.json, renaming
// each key to its prefixed name (downloadrr -> "movies:<key>", downloadrr-tv -> "tv:<key>", home -> "home:<key>"). It never
// overwrites a key Media already has, never touches a source file and changes nothing when run twice. API keys live in the
// keychain and cannot be migrated: set them again on the Settings page.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { MOVIES_KEYS, moviesKeyMap, TV_KEYS, tvKeyMap, HOME_KEYS, homeKeyMap } from "../Apps/Media/core/migrate-keys.js";

const SOURCES = [
	{ app: "home", keys: HOME_KEYS, map: homeKeyMap },
	{ app: "downloadrr", keys: MOVIES_KEYS, map: moviesKeyMap },
	{ app: "downloadrr-tv", keys: TV_KEYS, map: tvKeyMap },
];

const storePath = (vaultDir, app) => path.join(vaultDir, ".helenite", "apps", app, "store.json");

export function migrate({ vaultDir, dryRun = false }) {
	const copied = [], skipped = [], errors = [];
	const target = storePath(vaultDir, "media");
	let existing = {};
	if (fs.existsSync(target)) {
		try { existing = JSON.parse(fs.readFileSync(target, "utf8")); }
		catch (e) { return { copied, skipped, errors: [`media: store.json is unreadable (${e.message}); nothing migrated`] }; }
		if (!existing || typeof existing !== "object" || Array.isArray(existing)) return { copied, skipped, errors: ["media: store.json is not an object; nothing migrated"] };
	}
	const next = { ...existing };
	for (const { app, keys, map } of SOURCES) {
		const file = storePath(vaultDir, app);
		if (!fs.existsSync(file)) { skipped.push(`no store for ${app}`); continue; }
		let src;
		try { src = JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { errors.push(`${app}: store.json could not be parsed (${e.message})`); continue; }
		if (!src || typeof src !== "object" || Array.isArray(src)) { errors.push(`${app}: store.json is not an object`); continue; }
		const names = map();
		for (const [key, value] of Object.entries(src)) {
			if (!keys.includes(key)) { skipped.push(`${app}:${key} (unmapped key)`); continue; }
			const to = names[key];
			if (Object.prototype.hasOwnProperty.call(next, to)) { skipped.push(`${to} (media already has it)`); continue; }
			next[to] = value;
			copied.push(to);
		}
	}
	if (!dryRun && copied.length) {
		fs.mkdirSync(path.dirname(target), { recursive: true });
		const tmp = `${target}.tmp-${process.pid}`;
		fs.writeFileSync(tmp, JSON.stringify(next, null, 2));
		fs.renameSync(tmp, target);
	}
	return { copied, skipped, errors };
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
