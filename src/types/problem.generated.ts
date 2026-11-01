/**
 * GENERATED FILE - DO NOT EDIT.
 * Source: schema/problem.schema.json. Regenerate with `npm run schema:types`.
 */

/**
 * One Elite Code practice problem. A problem is either a classic single-prompt coding problem (type "standard", exactly one stage) or a multi-stage interview simulation (type "simulation", 3-5 stages) where each stage extends the previous requirement. Solutions and tests are Python 3.14.
 */
export type Problem = {
  /**
   * Optional pointer to this schema file, for editor autocompletion. Ignored by the app.
   */
  $schema?: string;
  /**
   * Version of the problem format this file follows. Must be exactly 1 for the current format.
   */
  schemaVersion: 1;
  id: Slug;
  /**
   * Human-readable title shown in the problem list.
   */
  title: string;
  /**
   * "standard": one prompt, one stage. "simulation": an interview that evolves through 3-5 stages; the solver only sees the current stage and must keep earlier stages passing.
   */
  type: 'standard' | 'simulation';
  /**
   * Overall difficulty for a mid-to-senior engineer. For simulations, rate the final stage.
   */
  difficulty: 'easy' | 'medium' | 'hard';
  /**
   * 1-5 topic tags from the fixed vocabulary, most important first. Used for filtering and weakest-topic analytics.
   *
   * @minItems 1
   * @maxItems 5
   */
  tags: [Tag, ...Tag[]];
  /**
   * One or two plain-text sentences (no Markdown) shown in the problem list. Must not reveal the solution approach or future simulation stages.
   */
  summary: string;
  /**
   * Python code the editor starts with: the function or class signature(s) the tests call, with a docstring and a `pass` or `raise NotImplementedError` body. Must NOT pass the tests. For simulations, starter code covers only stage 1.
   */
  starterCode: string;
  /**
   * Third-party packages the solution or tests need. They are loaded before the code runs. Omit or leave empty for pure-Python problems (strongly preferred).
   *
   * @maxItems 3
   */
  packages?: PackageName[];
  /**
   * Wall-clock limit for one complete run of the solver's code plus every selected test, in the browser. Defaults to 5.
   */
  timeLimitSeconds?: number;
  /**
   * Realistic time for a strong candidate to finish the whole problem (all stages), in minutes.
   */
  estimatedMinutes: number;
  /**
   * Optional flavor: companies known to ask this kind of question. Free text.
   *
   * @maxItems 10
   */
  companies?: string[];
  /**
   * Optional flavor: free-form domain topics (e.g. "payments", "observability"). Unlike tags, not restricted to a vocabulary.
   *
   * @maxItems 10
   */
  topics?: string[];
  /**
   * Ordered stages. A standard problem has exactly one; a simulation has 3-5, revealed one at a time.
   *
   * @minItems 1
   * @maxItems 5
   */
  stages: [Stage, ...Stage[]];
};
/**
 * Globally unique, stable identifier. Lowercase kebab-case. Also used as the file name (<id>.json).
 */
export type Slug = string;
/**
 * Topic tag from the fixed vocabulary.
 *
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "tag".
 */
export type Tag =
  | 'array'
  | 'hash-map'
  | 'string'
  | 'string-parsing'
  | 'two-pointers'
  | 'sliding-window'
  | 'prefix-sum'
  | 'intervals'
  | 'sorting'
  | 'binary-search'
  | 'stack'
  | 'queue'
  | 'heap'
  | 'linked-list'
  | 'tree'
  | 'trie'
  | 'graph'
  | 'bfs'
  | 'dfs'
  | 'topological-sort'
  | 'union-find'
  | 'dynamic-programming'
  | 'greedy'
  | 'recursion'
  | 'math'
  | 'bit-manipulation'
  | 'design'
  | 'simulation'
  | 'caching'
  | 'concurrency'
  | 'scheduling'
  | 'time-series'
  | 'data-processing'
  | 'aggregation'
  | 'joins'
  | 'deduplication'
  | 'pandas';
/**
 * A package available to problems. Anything else is unavailable.
 *
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "packageName".
 */
export type PackageName = 'numpy' | 'pandas' | 'sortedcontainers';
/**
 * Stage identifier, unique within the problem.
 */
export type Slug1 = string;
/**
 * Test function name: starts with test_, then lowercase letters, digits and underscores. Unique across the whole problem.
 */
export type TestName = string;
/**
 * A progressive hint (Markdown). The first nudges, the last nearly gives the approach away, but no hint contains full code.
 *
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "hint".
 */
export type Hint = string;
/**
 * Lowercase kebab-case identifier: letters, digits and single hyphens, starting with a letter.
 *
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "slug".
 */
export type Slug2 = string;
/**
 * Test function name: starts with test_, then lowercase letters, digits and underscores. Unique across the whole problem.
 *
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "testName".
 */
export type TestName1 = string;

/**
 * One step of a problem. Standard problems have a single stage holding the whole prompt.
 *
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "stage".
 */
export interface Stage {
  id: Slug1;
  /**
   * Short stage title, e.g. "Per-user limits".
   */
  title: string;
  /**
   * Markdown prompt for this stage, written as the interviewer speaking. Defines every function/class/method signature the tests call, input/output formats, and the rules. Include at least one worked example.
   */
  requirement: string;
  /**
   * Tests the solver can read and run with Run. Cover the worked examples and one or two simple edge cases.
   *
   * @minItems 1
   * @maxItems 15
   */
  visibleTests: [TestCase, ...TestCase[]];
  /**
   * Tests only run on Submit. Cover edge cases, scale within the time limit, and shortcuts a naive solution would take.
   *
   * @minItems 1
   * @maxItems 30
   */
  hiddenTests: [TestCase, ...TestCase[]];
  /**
   * 2-3 ordered hints, revealed one at a time.
   *
   * @minItems 2
   * @maxItems 3
   */
  hints: [Hint, Hint, ...Hint[]];
  solution: Solution;
}
/**
 * One test: Python source defining a single zero-argument function named exactly `name`. It passes if it returns without raising. Use plain `assert actual == expected` statements.
 *
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "testCase".
 */
export interface TestCase {
  name: TestName;
  /**
   * Optional one-line description of what the test checks, shown to the solver when the test is visible or fails.
   */
  description?: string;
  /**
   * Python source: `def <name>():` followed by an indented body. May start with imports. Runs after the solver's code in the same namespace, so it can call the solver's functions and classes directly.
   */
  code: string;
}
/**
 * Reference solution for a stage.
 *
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "solution".
 */
export interface Solution {
  /**
   * Complete, runnable Python. For simulations it is cumulative: the whole program as it should look at the end of this stage, passing this stage's tests and every earlier stage's tests.
   */
  code: string;
  /**
   * Markdown walkthrough of the approach, why it is correct, and (for simulations) what had to be refactored from the previous stage.
   */
  explanation: string;
  /**
   * Big-O time of the key operations, with variables defined.
   */
  timeComplexity: string;
  /**
   * Big-O extra space, with variables defined.
   */
  spaceComplexity: string;
}
