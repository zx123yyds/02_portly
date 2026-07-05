import { execFile } from 'node:child_process';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const productName = 'Portly';
const version = '0.1.0';
const releaseDir = path.resolve('release');
const appPath = path.join(releaseDir, `${productName}.app`);
const resourcesPath = path.join(appPath, 'Contents', 'Resources');
const appResourcesPath = path.join(resourcesPath, 'app');

await rm(releaseDir, { recursive: true, force: true });
await mkdir(releaseDir, { recursive: true });

await execFileAsync('ditto', ['node_modules/electron/dist/Electron.app', appPath]);
await rm(path.join(resourcesPath, 'default_app.asar'), { force: true });

await mkdir(appResourcesPath, { recursive: true });
await cp('dist', path.join(appResourcesPath, 'dist'), { recursive: true });
await cp('dist-electron', path.join(appResourcesPath, 'dist-electron'), { recursive: true });
await cp('assets', path.join(appResourcesPath, 'assets'), { recursive: true });
await cp('build/icon.icns', path.join(resourcesPath, 'icon.icns'));
await writeFile(
  path.join(appResourcesPath, 'package.json'),
  `${JSON.stringify({
    name: 'portly',
    version,
    description: 'A small macOS menu bar app for local listening ports.',
    main: 'dist-electron/electron/main.js',
    type: 'commonjs'
  }, null, 2)}\n`
);

const plistPath = path.join(appPath, 'Contents', 'Info.plist');
await setPlist(plistPath, 'CFBundleDisplayName', productName);
await setPlist(plistPath, 'CFBundleName', productName);
await setPlist(plistPath, 'CFBundleIdentifier', 'com.zx123yyds.portly');
await setPlist(plistPath, 'CFBundleShortVersionString', version);
await setPlist(plistPath, 'CFBundleVersion', version);
await setPlist(plistPath, 'CFBundleIconFile', 'icon.icns');
await execFileAsync('codesign', ['--force', '--deep', '--sign', '-', appPath]);

const zipPath = path.join(releaseDir, `${productName}-${version}-arm64.zip`);
await execFileAsync('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', appPath, zipPath]);

const stagingDir = path.join(releaseDir, 'dmg-staging');
await mkdir(stagingDir, { recursive: true });
await execFileAsync('ditto', [appPath, path.join(stagingDir, `${productName}.app`)]);
await execFileAsync('ln', ['-s', '/Applications', path.join(stagingDir, 'Applications')]);

const dmgPath = path.join(releaseDir, `${productName}-${version}-arm64.dmg`);
await execFileAsync('hdiutil', [
  'create',
  '-volname',
  `${productName} ${version}`,
  '-srcfolder',
  stagingDir,
  '-ov',
  '-format',
  'UDZO',
  dmgPath
]);
await rm(stagingDir, { recursive: true, force: true });

console.log(`Created ${dmgPath}`);
console.log(`Created ${zipPath}`);

async function setPlist(plistPath, key, value) {
  await execFileAsync('/usr/libexec/PlistBuddy', ['-c', `Set :${key} ${value}`, plistPath]);
}
