import { cp, mkdir, rm, writeFile } from 'node:fs/promises';

const appDir = 'app';

await rm(appDir, { recursive: true, force: true });
await mkdir(appDir, { recursive: true });

await cp('dist', `${appDir}/dist`, { recursive: true });
await cp('dist-electron/electron', `${appDir}/dist-electron/electron`, { recursive: true });
await cp('assets', `${appDir}/assets`, { recursive: true });

await writeFile(
  `${appDir}/package.json`,
  `${JSON.stringify({
    name: 'portly',
    version: '0.1.0',
    description: 'A small macOS menu bar app for local listening ports.',
    author: 'zx123yyds',
    main: 'dist-electron/electron/main.js',
    type: 'commonjs'
  }, null, 2)}\n`
);
