import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { collectProblemErrors, validateProblemsPlugin } from './vite-plugin-problems';

const example = readFileSync(
  path.resolve(import.meta.dirname, '../schema/examples/merge-meeting-ranges.json'),
  'utf8',
);

function dirWith(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'elite-problems-'));
  for (const [name, content] of Object.entries(files)) writeFileSync(path.join(dir, name), content);
  return dir;
}

describe('collectProblemErrors', () => {
  it('accepts a valid directory', () => {
    expect(collectProblemErrors(dirWith({ 'merge-meeting-ranges.json': example }))).toEqual([]);
  });

  it('reports schema errors, file-name mismatches and duplicate ids', () => {
    const errors = collectProblemErrors(
      dirWith({
        'a.json': example,
        'merge-meeting-ranges.json': example,
        'broken.json': '{',
        'notes.txt': 'ignored',
      }),
    );
    expect(errors).toHaveLength(3);
    expect(errors[0]).toMatch(/^a\.json: file name must be "merge-meeting-ranges\.json"/);
    expect(errors[1]).toMatch(/^broken\.json \(root\): invalid JSON/);
    expect(errors[2]).toMatch(/already used by a\.json/);
  });
});

describe('validateProblemsPlugin', () => {
  it('fails the build when a problem is invalid', () => {
    const plugin = validateProblemsPlugin(dirWith({ 'x.json': '{}' }));
    const ctx = { error: vi.fn() };
    (plugin.buildStart as unknown as (this: typeof ctx) => void).call(ctx);
    expect(ctx.error).toHaveBeenCalledWith(expect.stringContaining('missing required property'));
  });

  it('passes silently when every problem is valid', () => {
    const plugin = validateProblemsPlugin(dirWith({ 'merge-meeting-ranges.json': example }));
    const ctx = { error: vi.fn() };
    (plugin.buildStart as unknown as (this: typeof ctx) => void).call(ctx);
    expect(ctx.error).not.toHaveBeenCalled();
  });
});
