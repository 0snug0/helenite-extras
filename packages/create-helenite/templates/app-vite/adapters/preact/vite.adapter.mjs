// The Preact adapter's piece of the Vite config: the JSX transform (Vite's own, no plugin) and the entry file.
export default {
	entry: "src/main.jsx",
	oxc: { jsx: { runtime: "automatic", importSource: "preact" } },
	esbuild: { jsx: "automatic", jsxImportSource: "preact" }, // the same, for a Vite that still uses esbuild
};
