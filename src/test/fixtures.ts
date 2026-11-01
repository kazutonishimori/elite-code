import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { Problem } from '@/types/problem.generated';

const examples = path.resolve(import.meta.dirname, '../../schema/examples');

export function loadExample(id: 'merge-meeting-ranges' | 'inventory-reservations'): Problem {
  return JSON.parse(readFileSync(path.join(examples, `${id}.json`), 'utf8')) as Problem;
}
