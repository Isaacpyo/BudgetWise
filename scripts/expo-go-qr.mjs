// Generate docs/expo-go-qr.svg: a QR code that opens the latest EAS Update on
// the "production" channel in Expo Go. Run after `eas init` + the first
// `eas update` (see README → "Open in Expo Go").
//   npm run expo:qr
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import QRCode from 'qrcode';

// Resolve packages the way the app does (works with hoisted workspaces).
const require = createRequire(new URL('../apps/web/package.json', import.meta.url));
const app = JSON.parse(readFileSync(new URL('../apps/web/app.json', import.meta.url), 'utf8'));
const projectId = app.expo?.extra?.eas?.projectId;
if (!projectId) {
  console.error(
    'No EAS project id in apps/web/app.json. Run `npx eas-cli@latest init` in apps/web first.',
  );
  process.exit(1);
}

const sdkMajor = require('expo/package.json').version.split('.')[0];
const channel = process.argv[2] ?? 'production';
// Expo Go loads updates whose runtime version is the SDK version (runtimeVersion.policy = sdkVersion).
const url = `exp://u.expo.dev/${projectId}?channel-name=${channel}&runtime-version=exposdk:${sdkMajor}.0.0`;

const svg = await QRCode.toString(url, {
  type: 'svg',
  margin: 2,
  width: 240,
  color: { dark: '#0b0b0b', light: '#ffffff' },
});
writeFileSync(new URL('../docs/expo-go-qr.svg', import.meta.url), svg);
console.warn(`Wrote docs/expo-go-qr.svg for ${url}`);
