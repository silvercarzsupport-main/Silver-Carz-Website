import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const projectRoot = process.cwd();

/**
 * Keep Next's `.next` cache off iCloud Desktop/Documents.
 * Native file locks and FSEvents on that folder hang `next dev` with no output.
 */
function relocateOffICloud(name, targetName) {
  const linkPath = join(projectRoot, name);
  const dest = join(tmpdir(), targetName);

  try {
    if (lstatSync(linkPath).isSymbolicLink() && readlinkSync(linkPath) === dest) {
      process.stdout.write(`${name} → ${dest}\n`);
      return;
    }
  } catch {
    // missing
  }

  if (existsSync(linkPath) && lstatSync(linkPath).isSymbolicLink()) {
    rmSync(linkPath, { force: true });
  } else if (existsSync(linkPath)) {
    rmSync(linkPath, { recursive: true, force: true });
  }

  mkdirSync(dest, { recursive: true });
  symlinkSync(dest, linkPath);
  process.stdout.write(`${name} → ${dest}\n`);
}

relocateOffICloud('.next', 'silver-carz-next');

/**
 * Next 16's setup-dev-bundler watches the whole repo root. On iCloud that scan
 * never emits Watchpack `aggregated`, so the server prints Ready then every
 * HTTP request hangs with 0 bytes. Scope the watcher to app/pages + real files.
 */
function patchWatchpackRootScan() {
  const bundlerFiles = [
    join(projectRoot, 'node_modules/next/dist/server/lib/router-utils/setup-dev-bundler.js'),
    join(projectRoot, 'node_modules/next/dist/esm/server/lib/router-utils/setup-dev-bundler.js'),
  ];

  const oldWatch = `        wp.watch({
            directories: [
                dir
            ],
            startTime: 0
        });`;

  const oldWatchFiles = `        wp.watch({
            directories,
            files,
            startTime: 0
        });`;

  const oldPromise = `await new Promise(async (resolve, reject)=>{\n        if (pagesDir) {`;
  const newPromise = `await new Promise(async (resolve, reject)=>{\n        setTimeout(()=>{\n            if (!resolved) {\n                resolve();\n                resolved = true;\n            }\n        }, 4000);\n        if (pagesDir) {`;

  for (const file of bundlerFiles) {
    if (!existsSync(file)) continue;
    let source = readFileSync(file, 'utf8');
    const existsCall = source.includes('_fs.default') ? '_fs.default.existsSync' : 'fs.existsSync';
    const newWatch = `        const existingWatchFiles = files.filter((filePath)=>{
            try {
                return ${existsCall}(filePath);
            } catch  {
                return false;
            }
        });
        wp.watch({
            directories,
            files: existingWatchFiles,
            startTime: 0
        });`;
    let changed = false;
    if (source.includes(oldWatch)) {
      source = source.replace(oldWatch, newWatch);
      changed = true;
    } else if (source.includes(oldWatchFiles)) {
      source = source.replace(oldWatchFiles, newWatch);
      changed = true;
    }
    if (source.includes(oldPromise)) {
      source = source.replace(oldPromise, newPromise);
      changed = true;
    }
    if (changed) {
      writeFileSync(file, source);
    }
  }
}

patchWatchpackRootScan();
