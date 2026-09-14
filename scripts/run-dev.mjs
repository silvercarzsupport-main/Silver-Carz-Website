import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const projectRoot = process.cwd();
const dest = join(tmpdir(), 'silver-carz-dev');

mkdirSync(dest, { recursive: true });

const syncedDirs = ['src', 'public'];
const syncedFiles = [
  'next.config.ts',
  'tsconfig.json',
  'postcss.config.mjs',
  'next-env.d.ts',
  'components.json',
  '.env.local',
  '.env',
  '.env.example',
];

function syncFile(name) {
  const from = join(projectRoot, name);
  const to = join(dest, name);
  if (!existsSync(from)) {
    return;
  }
  rmSync(to, { force: true });
  cpSync(from, to);
}

function syncDir(name) {
  const from = join(projectRoot, name);
  const to = join(dest, name);
  if (!existsSync(from)) {
    return;
  }
  try {
    if (lstatSync(to).isSymbolicLink()) {
      rmSync(to, { force: true });
    }
  } catch {
    // missing
  }
  mkdirSync(to, { recursive: true });
  spawnSync('rsync', ['-a', `${from}/`, `${to}/`]);
}

for (const name of syncedDirs) {
  syncDir(name);
}
for (const name of syncedFiles) {
  syncFile(name);
}

const copied = ['package.json', 'pnpm-lock.yaml', 'patches'];

for (const name of copied) {
  const from = join(projectRoot, name);
  const to = join(dest, name);
  if (!existsSync(from)) continue;
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
}

const destPackageJsonPath = join(dest, 'package.json');
if (existsSync(destPackageJsonPath)) {
  const pkg = JSON.parse(readFileSync(destPackageJsonPath, 'utf8'));
  if (pkg.pnpm?.patchedDependencies) {
    delete pkg.pnpm.patchedDependencies;
    writeFileSync(destPackageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);
  }
}

const lockfile = readFileSync(join(projectRoot, 'pnpm-lock.yaml'));
const lockHash = createHash('sha1').update(lockfile).digest('hex').slice(0, 16);
const stampPath = join(dest, '.lockhash');
const nextBin = join(dest, 'node_modules', 'next', 'dist', 'bin', 'next');
const needsInstall = !existsSync(nextBin) || !existsSync(stampPath) || readFileSync(stampPath, 'utf8') !== lockHash;

if (needsInstall) {
  const destModules = join(dest, 'node_modules');
  if (!existsSync(nextBin) && existsSync(destModules)) {
    process.stdout.write('Temp node_modules is incomplete; reinstalling…\n');
    rmSync(destModules, { recursive: true, force: true });
  }
  process.stdout.write(`Installing dependencies in ${dest} (off iCloud)…\n`);
  const result = spawnSync('pnpm', ['install', '--no-frozen-lockfile'], {
    cwd: dest,
    stdio: 'inherit',
    env: { ...process.env, HUSKY: '0' },
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
  if (!existsSync(nextBin)) {
    process.stderr.write(`next binary missing after install: ${nextBin}\n`);
    process.exit(1);
  }
  writeFileSync(stampPath, lockHash);
}

function patchWatchpackRootScan() {
  const bundlerFiles = [
    join(dest, 'node_modules/next/dist/server/lib/router-utils/setup-dev-bundler.js'),
    join(dest, 'node_modules/next/dist/esm/server/lib/router-utils/setup-dev-bundler.js'),
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
process.stdout.write(`next dev → ${dest}\n`);

const child = spawn(
  process.execPath,
  [nextBin, 'dev', '--port', '3000'],
  {
    cwd: dest,
    stdio: 'inherit',
    env: {
      ...process.env,
      HUSKY: '0',
      WATCHPACK_POLLING: '1000',
      CHOKIDAR_USEPOLLING: '1',
    },
  },
);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
