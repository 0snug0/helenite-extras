// Saves the types, the ui-kit bundle and the multi-page shell into vendor/, so a packed create-helenite (pnpm pack runs this as prepack)
// works away from a helenite-extras checkout (or extras/ in the app).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { heleniteTypes, pagesShell, uiKitBundle, vendorDir } from './assets.mjs';

mkdirSync(vendorDir, { recursive: true });
writeFileSync(join(vendorDir, 'helenite.d.ts'), heleniteTypes());
writeFileSync(join(vendorDir, 'ui-kit.js'), await uiKitBundle());
const shell = pagesShell();
writeFileSync(join(vendorDir, 'pages-router.js'), shell['router.js']);
writeFileSync(join(vendorDir, 'pages-shell.js'), shell['shell.js']);
console.log(`wrote ${vendorDir}/helenite.d.ts, ui-kit.js, pages-router.js and pages-shell.js`);
