// Builds src/ into plain static files: view.js (one ES module, everything bundled in) and view.css, plus app.md.
// The sandboxed frame loads those files unchanged, so nothing about the manifest, permissions or CSP depends on the
// framework. The framework lives in vite.adapter.mjs; to switch it, swap that file and src/helenite/.
// Where the files go: the folder in helenite.json ("appDir", written by create-helenite --app-dir, an app folder in the
// vault while this project stays outside it), or this folder.
import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import adapter from "./vite.adapter.mjs";
import style from "./vite.style.mjs"; // the CSS framework (--style); empty without one

const here = dirname(fileURLToPath(import.meta.url));
const config = existsSync(join(here, "helenite.json")) ? JSON.parse(readFileSync(join(here, "helenite.json"), "utf8")) : {};
const outDir = config.appDir ? resolve(config.appDir) : here;

export default defineConfig({
	...adapter,
	...(style.css ? { css: style.css } : {}),
	define: { "process.env.NODE_ENV": '"production"' },
	plugins: [
		...(adapter.plugins ?? []),
		...(style.plugins ?? []),
		{ name: "helenite-app-md", closeBundle() { if (outDir !== here) copyFileSync(join(here, "app.md"), join(outDir, "app.md")); } },
	],
	build: {
		lib: { entry: adapter.entry, formats: ["es"], fileName: () => "view.js", cssFileName: "view" },
		outDir,
		emptyOutDir: false, // outDir may be the app folder itself: never let Vite clean it
		target: "chrome140",
		minify: true,
		rolldownOptions: { output: { codeSplitting: false } }, // a frame imports view.js alone: no chunks
	},
});
