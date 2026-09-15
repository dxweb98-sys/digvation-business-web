import { readdir } from 'node:fs/promises';
import { extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const scanRoots = ['apps', 'packages', 'tooling'];
const ignoredDirectories = new Set(['node_modules', 'dist', 'coverage', 'generated']);
const allowedRootLikeFiles = new Set([
  'vite.config.ts',
  'vitest.config.ts',
  'playwright.config.ts',
  'eslint.config.mjs',
]);

const kebabCase = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const filePattern =
  /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.(?:test|spec|types|schema|port|adapter|provider|context|fixture|config))*\.(?:ts|tsx|js|mjs|css|json|md)$/;

const violations = [];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    if (ignoredDirectories.has(entry.name)) continue;
    const absolutePath = resolve(directory, entry.name);
    const repoPath = relative(root, absolutePath).replaceAll('\\', '/');

    if (entry.isDirectory()) {
      if (!kebabCase.test(entry.name)) violations.push(`directory: ${repoPath}`);
      await walk(absolutePath);
      continue;
    }

    if (allowedRootLikeFiles.has(entry.name)) continue;
    if (
      entry.name === 'package.json' ||
      entry.name === 'tsconfig.json' ||
      entry.name === 'index.html' ||
      entry.name === 'vite-env.d.ts'
    ) {
      continue;
    }

    if (extname(entry.name) && !filePattern.test(entry.name)) violations.push(`file: ${repoPath}`);
  }
}

for (const scanRoot of scanRoots) {
  await walk(resolve(root, scanRoot));
}

if (violations.length > 0) {
  console.error(`Naming violations:\n${violations.map((item) => `- ${item}`).join('\n')}`);
  process.exit(1);
}

console.log('Repository naming is valid.');
