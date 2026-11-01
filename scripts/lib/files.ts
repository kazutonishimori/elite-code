import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

/** Expands files and directories into problem JSON files (skipping fixture folders). */
export function collectJsonFiles(inputs: string[]): string[] {
  const files: string[] = [];
  const walk = (entry: string) => {
    if (statSync(entry).isDirectory()) {
      for (const child of readdirSync(entry).sort()) {
        if (child === 'fixtures' || child === 'node_modules' || child.startsWith('.')) continue;
        walk(path.join(entry, child));
      }
    } else if (entry.endsWith('.json')) {
      files.push(entry);
    }
  };
  inputs.forEach(walk);
  return files;
}

/** Runs `fn` over items with at most `limit` in flight, preserving input order in the output. */
export async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
