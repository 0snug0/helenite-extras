// Builds src/ into plain static files beside app.md: view.js (one ES module, everything bundled in) and view.css.
// The sandboxed frame loads those two files unchanged, so nothing about the manifest, permissions or CSP depends on
// the framework. The framework lives in vite.adapter.mjs; to switch it, swap that file and src/helenite/.
import { defineConfig } from "vite";
import adapter from "./vite.adapter.mjs";

export default defineConfig({
	...adapter,
	define: { "process.env.NODE_ENV": '"production"' },
	build: {
		lib: { entry: adapter.entry, formats: ["es"], fileName: () => "view.js", cssFileName: "view" },
		outDir: ".",
		emptyOutDir: false, // outDir is the app folder itself: never let Vite clean it
		target: "chrome140",
		minify: true,
		rolldownOptions: { output: { codeSplitting: false } }, // a frame imports view.js alone: no chunks
	},
});
