/**
 * Copies the Pyodide runtime from node_modules into public/pyodide and downloads the
 * wheels for every allowed package (plus dependencies), verified against the lock file's
 * sha256. After this runs once, the app never touches the network to execute Python.
 *
 * Idempotent: files that already exist with the right hash are skipped.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pyodideDir = path.join(root, 'node_modules', 'pyodide');
export const assetsDir = path.join(root, 'public', 'pyodide');

const CORE_FILES = [
  'pyodide.mjs',
  'pyodide.asm.mjs',
  'pyodide.asm.wasm',
  'python_stdlib.zip',
  'pyodide-lock.json',
];

interface LockPackage {
  name: string;
  file_name: string;
  sha256: string;
  depends: string[];
}

interface Lock {
  packages: Record<string, LockPackage>;
}

async function sha256(file: string): Promise<string> {
  return createHash('sha256')
    .update(await readFile(file))
    .digest('hex');
}

async function allowedPackages(): Promise<string[]> {
  const schemaPath = path.join(root, 'schema', 'problem.schema.json');
  if (!existsSync(schemaPath)) return [];
  const schema = JSON.parse(await readFile(schemaPath, 'utf8')) as {
    $defs?: { packageName?: { enum?: string[] } };
  };
  return schema.$defs?.packageName?.enum ?? [];
}

export function resolveClosure(lock: Lock, names: string[]): LockPackage[] {
  const seen = new Map<string, LockPackage>();
  const visit = (name: string) => {
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    const pkg = lock.packages[key];
    if (!pkg) throw new Error(`Package "${name}" is not in the Pyodide lock file`);
    seen.set(key, pkg);
    pkg.depends.forEach(visit);
  };
  names.forEach(visit);
  return [...seen.values()];
}

async function main() {
  const { version } = JSON.parse(await readFile(path.join(pyodideDir, 'package.json'), 'utf8')) as {
    version: string;
  };
  await mkdir(assetsDir, { recursive: true });

  for (const file of CORE_FILES) {
    const src = path.join(pyodideDir, file);
    const dest = path.join(assetsDir, file);
    if (!existsSync(dest) || (await sha256(src)) !== (await sha256(dest))) {
      await copyFile(src, dest);
    }
  }

  const lock = JSON.parse(
    await readFile(path.join(pyodideDir, 'pyodide-lock.json'), 'utf8'),
  ) as Lock;
  const packages = resolveClosure(lock, await allowedPackages());
  const baseUrl = `https://cdn.jsdelivr.net/pyodide/v${version}/full/`;
  let downloaded = 0;

  for (const pkg of packages) {
    const dest = path.join(assetsDir, pkg.file_name);
    if (existsSync(dest) && (await sha256(dest)) === pkg.sha256) continue;
    const res = await fetch(baseUrl + pkg.file_name);
    if (!res.ok) throw new Error(`Failed to download ${pkg.file_name}: HTTP ${res.status}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    const digest = createHash('sha256').update(bytes).digest('hex');
    if (digest !== pkg.sha256) throw new Error(`Checksum mismatch for ${pkg.file_name}`);
    await writeFile(dest, bytes);
    downloaded += 1;
  }

  await writeFile(path.join(assetsDir, 'VERSION'), `${version}\n`);
  console.log(
    `pyodide ${version}: core ready, ${packages.length} package wheel(s) present` +
      (downloaded ? ` (${downloaded} downloaded)` : ''),
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
