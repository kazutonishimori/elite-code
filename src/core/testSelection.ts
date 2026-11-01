/**
 * Which tests run for Run / Submit, and how their results are classified.
 * Run    = the current stage's visible tests.
 * Submit = visible + hidden tests of every stage up to and including the current one.
 */

import type {
  HarnessTest,
  HarnessTestResult,
  RunOutcome,
  RunRequest,
  TestVisibility,
} from '@/runner/types';
import type { Problem, Stage, TestCase } from '@/types/problem.generated';

import { timeLimitMs } from './problemValidation';

export type ExecutionMode = 'run' | 'submit';

function stageTests(stage: Stage, stageIndex: number, includeHidden: boolean): HarnessTest[] {
  const toHarness =
    (visibility: TestVisibility) =>
    (test: TestCase): HarnessTest => ({
      name: test.name,
      code: test.code,
      stageId: stage.id,
      stageIndex,
      visibility,
    });
  const visible = stage.visibleTests.map(toHarness('visible'));
  return includeHidden ? [...visible, ...stage.hiddenTests.map(toHarness('hidden'))] : visible;
}

export function selectTests(
  problem: Problem,
  stageIndex: number,
  mode: ExecutionMode,
): HarnessTest[] {
  const stage = problem.stages[stageIndex];
  if (!stage) throw new RangeError(`Stage ${stageIndex} does not exist in "${problem.id}"`);
  if (mode === 'run') return stageTests(stage, stageIndex, false);
  return problem.stages.slice(0, stageIndex + 1).flatMap((s, i) => stageTests(s, i, true));
}

/** Tests a stage introduces (visible + hidden), without earlier stages. */
export function newTestsOfStage(problem: Problem, stageIndex: number): HarnessTest[] {
  const stage = problem.stages[stageIndex];
  if (!stage) throw new RangeError(`Stage ${stageIndex} does not exist in "${problem.id}"`);
  return stageTests(stage, stageIndex, true);
}

export function buildRunRequest(
  problem: Problem,
  stageIndex: number,
  mode: ExecutionMode | 'custom',
  code: string,
  customInput = '',
): RunRequest {
  return {
    payload: {
      code,
      mode,
      tests: mode === 'custom' ? [] : selectTests(problem, stageIndex, mode),
      ...(mode === 'custom' ? { customInput } : {}),
    },
    packages: problem.packages ?? [],
    timeoutMs: timeLimitMs(problem),
  };
}

export interface ClassifiedTest extends HarnessTestResult {
  /** A failing test from a stage before the current one: previously working code broke. */
  regression: boolean;
  /** 1-based stage number, for display ("Stage 2 test broke"). */
  stageNumber: number;
}

export type Verdict =
  'accepted' | 'failed' | 'compile_error' | 'load_error' | 'timeout' | 'crashed';

export interface RunSummary {
  verdict: Verdict;
  total: number;
  passed: number;
  failed: number;
  regressions: number;
  runtimeMs: number | null;
  tests: ClassifiedTest[];
  message: string | null;
}

export function regressionLabel(test: Pick<ClassifiedTest, 'stageNumber'>): string {
  return `Stage ${test.stageNumber} test broke`;
}

export function classifyTests(
  tests: HarnessTestResult[],
  currentStageIndex: number,
): ClassifiedTest[] {
  return tests.map((t) => ({
    ...t,
    stageNumber: t.stageIndex + 1,
    regression: t.status !== 'passed' && t.status !== 'skipped' && t.stageIndex < currentStageIndex,
  }));
}

export function summarizeOutcome(outcome: RunOutcome, currentStageIndex: number): RunSummary {
  if (outcome.kind === 'timeout') {
    return {
      verdict: 'timeout',
      total: 0,
      passed: 0,
      failed: 0,
      regressions: 0,
      runtimeMs: outcome.timeoutMs,
      tests: [],
      message: `Time limit exceeded (${outcome.timeoutMs / 1000}s): possible infinite loop, or the solution is too slow.`,
    };
  }
  if (outcome.kind === 'crashed') {
    return {
      verdict: 'crashed',
      total: 0,
      passed: 0,
      failed: 0,
      regressions: 0,
      runtimeMs: null,
      tests: [],
      message: outcome.message,
    };
  }
  const { result } = outcome;
  const tests = classifyTests(result.tests, currentStageIndex);
  const passed = tests.filter((t) => t.status === 'passed').length;
  let verdict: Verdict;
  if (result.status !== 'ok') verdict = result.status;
  else verdict = tests.length > 0 && passed === tests.length ? 'accepted' : 'failed';
  return {
    verdict,
    total: tests.length,
    passed,
    failed: tests.length - passed,
    regressions: tests.filter((t) => t.regression).length,
    runtimeMs: outcome.wallTimeMs,
    tests,
    message: result.error?.message ?? null,
  };
}
