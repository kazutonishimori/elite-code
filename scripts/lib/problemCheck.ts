/** Everything `problem:validate` checks: schema, semantics, then real execution with CPython. */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  formatIssue,
  parseAndValidateProblem,
  timeLimitMs,
} from '../../src/core/problemValidation.ts';
import { newTestsOfStage, selectTests } from '../../src/core/testSelection.ts';
import type { CodeRunner, HarnessTest, HarnessTestResult } from '../../src/runner/types.ts';
import type { Problem } from '../../src/types/problem.generated.ts';

export interface CheckReport {
  file: string;
  id: string | null;
  errors: string[];
  warnings: string[];
  notes: string[];
}

/** Share of the time limit a CPython run may use before we warn (the browser is slower). */
export const SLOW_RUN_FRACTION = 0.25;

const PACKAGE_IMPORT = /^\s*(?:import|from)\s+(numpy|pandas|sortedcontainers)\b/gm;

function allCode(problem: Problem): string[] {
  return [
    problem.starterCode,
    ...problem.stages.flatMap((s) => [
      s.solution.code,
      ...s.visibleTests.map((t) => t.code),
      ...s.hiddenTests.map((t) => t.code),
    ]),
  ];
}

export function undeclaredPackages(problem: Problem): string[] {
  const declared = new Set<string>(problem.packages ?? []);
  const used = new Set<string>();
  for (const code of allCode(problem)) {
    for (const [, name] of code.matchAll(PACKAGE_IMPORT)) if (name) used.add(name);
  }
  return [...used].filter((p) => !declared.has(p)).sort();
}

function describeFailure(t: HarnessTestResult): string {
  const detail = t.message ?? t.errorType ?? t.status;
  return `${t.name} (${t.status}): ${detail.split('\n')[0]}`;
}

type Execution =
  { ok: true; tests: HarnessTestResult[]; wallTimeMs: number } | { ok: false; reason: string };

async function execute(
  runner: CodeRunner,
  problem: Problem,
  code: string,
  tests: HarnessTest[],
): Promise<Execution> {
  const timeoutMs = timeLimitMs(problem);
  const outcome = await runner.run({
    payload: { code, tests, mode: 'submit' },
    packages: problem.packages ?? [],
    timeoutMs,
  });
  if (outcome.kind === 'timeout')
    return { ok: false, reason: `time limit exceeded (${timeoutMs / 1000}s)` };
  if (outcome.kind === 'crashed')
    return { ok: false, reason: `runner crashed: ${outcome.message}` };
  const { result } = outcome;
  if (result.status !== 'ok') {
    return {
      ok: false,
      reason: `${result.status.replace('_', ' ')}: ${result.error?.type}: ${result.error?.message}`,
    };
  }
  return { ok: true, tests: result.tests, wallTimeMs: outcome.wallTimeMs };
}

export async function checkProblem(
  problem: Problem,
  runner: CodeRunner,
): Promise<Omit<CheckReport, 'file'>> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const notes: string[] = [];
  const limit = timeLimitMs(problem);

  for (const pkg of undeclaredPackages(problem)) {
    errors.push(`code imports "${pkg}" but "packages" does not declare it`);
  }

  const starter = await execute(
    runner,
    problem,
    problem.starterCode,
    selectTests(problem, 0, 'submit'),
  );
  if (!starter.ok) {
    if (!starter.reason.startsWith('time limit'))
      errors.push(`starter code must run without errors: ${starter.reason}`);
  } else if (starter.tests.every((t) => t.status === 'passed')) {
    errors.push('starter code passes every stage 1 test; it must only contain signatures');
  }

  for (const [k, stage] of problem.stages.entries()) {
    const label = `stage ${k + 1}`;
    const run = await execute(
      runner,
      problem,
      stage.solution.code,
      selectTests(problem, k, 'submit'),
    );
    if (!run.ok) {
      errors.push(`${label} solution: ${run.reason}`);
      continue;
    }
    const failures = run.tests.filter((t) => t.status !== 'passed');
    for (const t of failures) {
      errors.push(`${label} solution fails stage ${t.stageIndex + 1} test ${describeFailure(t)}`);
    }
    if (failures.length === 0) {
      notes.push(
        `${label}: solution passes ${run.tests.length} cumulative tests in ${Math.round(run.wallTimeMs)} ms`,
      );
    }
    if (run.wallTimeMs > limit * SLOW_RUN_FRACTION) {
      warnings.push(
        `${label} solution used ${Math.round(run.wallTimeMs)} ms of the ${limit} ms limit on CPython; ` +
          'the browser is 2-4x slower, so shrink large tests or raise timeLimitSeconds',
      );
    }

    const previousStage = problem.stages[k - 1];
    if (previousStage) {
      const previous = await execute(
        runner,
        problem,
        previousStage.solution.code,
        newTestsOfStage(problem, k),
      );
      const failing = previous.ok
        ? previous.tests.filter((t) => t.status !== 'passed').length
        : null;
      if (failing === 0) {
        errors.push(
          `${label} adds no failing test against the stage ${k} solution; the stage must add a requirement`,
        );
      } else {
        notes.push(
          `${label}: ${failing ?? 'all'} new test(s) fail against the stage ${k} solution`,
        );
      }
    }
  }

  return { id: problem.id, errors, warnings, notes };
}

export async function checkProblemFile(
  file: string,
  runner: CodeRunner,
  options: { requireMatchingFileName?: boolean } = {},
): Promise<CheckReport> {
  const text = await readFile(file, 'utf8');
  const parsed = parseAndValidateProblem(text);
  if (!parsed.ok) {
    return { file, id: null, errors: parsed.issues.map(formatIssue), warnings: [], notes: [] };
  }
  const report = { file, ...(await checkProblem(parsed.problem, runner)) };
  const expectedName = `${parsed.problem.id}.json`;
  if (path.basename(file) !== expectedName) {
    const message = `file name should be "${expectedName}"`;
    (options.requireMatchingFileName ? report.errors : report.warnings).push(message);
  }
  return report;
}
