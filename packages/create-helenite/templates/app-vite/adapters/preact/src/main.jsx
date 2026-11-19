import "./style.css";
import { defineApp } from "./helenite/index.jsx";
import App from "./App.jsx";

// Helenite imports this module and calls its default export with (root, api). The same export also works as a page of a
// multi-page app: the shell calls it with (host, ctx).
export default defineApp(App);
