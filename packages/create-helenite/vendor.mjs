// Saves the types and the ui-kit bundle into vendor/, so a packed create-helenite (pnpm pack runs this as prepack)
// works away from a Helenite checkout.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { heleniteTypes, uiKitBundle, vendorDir } from './assets.mjs';

mkdirSync(vendorDir, { recursive: true });
writeFileSync(join(vendorDir, 'helenite.d.ts'), heleniteTypes());
writeFileSync(join(vendorDir, 'ui-kit.js'), await uiKitBundle());
console.log(`wrote ${vendorDir}/helenite.d.ts and ui-kit.js`);
