// Tailwind v4 through its Vite plugin: it scans src/ for class names and emits only the utilities used, into view.css.
import tailwindcss from "@tailwindcss/vite";

export default { plugins: [tailwindcss()] };
