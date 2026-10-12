// Copy Skia's CanvasKit WASM next to the web bundle so charts can load it.
// Runs before `expo start --web` and `expo export -p web`; the copy is gitignored.
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const skiaDir = dirname(require.resolve('@shopify/react-native-skia/package.json'));
const wasm = createRequire(join(skiaDir, 'package.json')).resolve(
  'canvaskit-wasm/bin/full/canvaskit.wasm',
);
const out = join(here, '..', 'public', 'canvaskit.wasm');
mkdirSync(dirname(out), { recursive: true });
copyFileSync(wasm, out);
console.warn(`canvaskit.wasm -> ${out}`);
