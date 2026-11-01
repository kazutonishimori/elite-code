/**
 * Problem validation shared by the app (import dialog), the Vite build plugin and the CLI.
 * Layer 1 is the JSON Schema (Ajv, draft 2020-12); layer 2 covers rules the schema can't express.
 */
import Ajv2020, { type ErrorObject } from 'ajv/dist/2020.js';

import schema from '../../schema/problem.schema.json';
import type { Problem } from '../types/problem.generated';

export interface ProblemIssue {
  /** JSON Pointer to the offending value, e.g. `/stages/1/hints`. Empty string = document root. */
  path: string;
  /** Human-readable explanation, phrased so an author knows how to fix it. */
  message: string;
  /** Ajv keyword (`required`, `enum`, ...) or a semantic rule id (`unique-test-names`, ...). */
  rule: string;
}

export type ValidationResult =
  | { ok: true; problem: Problem; issues: [] }
  | { ok: false; problem?: undefined; issues: ProblemIssue[] };

export const SUPPORTED_SCHEMA_VERSION = 1;
export const DEFAULT_TIME_LIMIT_SECONDS = 5;

const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
const validateSchema = ajv.compile<Problem>(schema);

export const ALLOWED_PACKAGES: readonly string[] = schema.$defs.packageName.enum;
export const TAGS: readonly string[] = schema.$defs.tag.enum;

function describeAjvError(err: ErrorObject): string {
  const params = err.params as Record<string, unknown>;
  switch (err.keyword) {
    case 'required':
      return `missing required property "${String(params.missingProperty)}"`;
    case 'additionalProperties':
      return `unknown property "${String(params.additionalProperty)}" (not allowed by the schema)`;
    case 'enum':
      return `must be one of: ${(params.allowedValues as unknown[]).map((v) => JSON.stringify(v)).join(', ')}`;
    case 'const':
      return `must be exactly ${JSON.stringify(params.allowedValue)}`;
    case 'pattern':
      return `must match pattern ${String(params.pattern)}`;
    case 'type':
      return `must be of type ${String(params.type)}`;
    default:
      return err.message ?? `failed "${err.keyword}"`;
  }
}

function fromAjv(errors: ErrorObject[]): ProblemIssue[] {
  const issues: ProblemIssue[] = [];
  const seen = new Set<string>();
  for (const err of errors) {
    // "if" errors only say a "then" branch failed; the concrete error is reported separately.
    if (err.keyword === 'if') continue;
    const issue = { path: err.instancePath, message: describeAjvError(err), rule: err.keyword };
    const key = `${issue.path}|${issue.message}`;
    if (!seen.has(key)) {
      seen.add(key);
      issues.push(issue);
    }
  }
  return issues;
}

const defRegex = (name: string) => new RegExp(`^def\\s+${name}\\s*\\(\\s*\\)`, 'm');

/** Rules JSON Schema can't express. Assumes the document already passed the schema. */
export function semanticIssues(problem: Problem): ProblemIssue[] {
  const issues: ProblemIssue[] = [];
  const stageIds = new Map<string, number>();
  const testNames = new Map<string, string>();

  problem.stages.forEach((stage, s) => {
    const previous = stageIds.get(stage.id);
    if (previous !== undefined) {
      issues.push({
        path: `/stages/${s}/id`,
        message: `duplicate stage id "${stage.id}" (also used by stage ${previous + 1})`,
        rule: 'unique-stage-ids',
      });
    } else {
      stageIds.set(stage.id, s);
    }

    for (const kind of ['visibleTests', 'hiddenTests'] as const) {
      stage[kind].forEach((test, t) => {
        const path = `/stages/${s}/${kind}/${t}`;
        const firstUse = testNames.get(test.name);
        if (firstUse) {
          issues.push({
            path: `${path}/name`,
            message: `duplicate test name "${test.name}" (first used at ${firstUse}); test names must be unique across the whole problem`,
            rule: 'unique-test-names',
          });
        } else {
          testNames.set(test.name, path);
        }
        if (!defRegex(test.name).test(test.code)) {
          issues.push({
            path: `${path}/code`,
            message: `code must define a zero-argument function "def ${test.name}():" at the top level`,
            rule: 'test-defines-function',
          });
        }
      });
    }

    const hints = new Set(stage.hints);
    if (hints.size !== stage.hints.length) {
      issues.push({
        path: `/stages/${s}/hints`,
        message: 'hints must all be different',
        rule: 'unique-hints',
      });
    }
  });

  return issues;
}

export function validateProblem(data: unknown): ValidationResult {
  if (!validateSchema(data)) {
    return { ok: false, issues: fromAjv(validateSchema.errors ?? []) };
  }
  const issues = semanticIssues(data);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, problem: data, issues: [] };
}

/** Parses JSON text and validates it. JSON syntax errors become a single root-level issue. */
export function parseAndValidateProblem(text: string): ValidationResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (err) {
    return {
      ok: false,
      issues: [
        { path: '', message: `invalid JSON: ${(err as Error).message}`, rule: 'json-syntax' },
      ],
    };
  }
  return validateProblem(data);
}

export function formatIssue(issue: ProblemIssue): string {
  return `${issue.path || '(root)'}: ${issue.message} [${issue.rule}]`;
}

export function timeLimitMs(problem: Pick<Problem, 'timeLimitSeconds'>): number {
  return (problem.timeLimitSeconds ?? DEFAULT_TIME_LIMIT_SECONDS) * 1000;
}
