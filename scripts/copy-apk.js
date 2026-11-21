// Copies the built debug APK to the project root as synaa.apk
// so the download button in synaa-download.html works.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const candidates = [
  path.join(root, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk'),
  path.join(root, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk'),
];

const source = candidates.find((p) => fs.existsSync(p));
if (!source) {
  console.error('❌ لم يتم العثور على APK. شغّل أولاً: npm run apk:debug');
  process.exit(1);
}

const target = path.join(root, 'synaa.apk');
fs.copyFileSync(source, target);
const sizeMb = (fs.statSync(target).size / (1024 * 1024)).toFixed(2);
console.log(`✅ تم نسخ APK إلى: ${target} (${sizeMb} MB)`);
