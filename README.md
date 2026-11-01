# Elite Code

A local, single-user, LeetCode-style practice platform for **mid-to-senior software and data
engineer interviews**. You solve Python problems in an in-browser IDE and run them against tests,
all on your machine: Python runs in the browser via [Pyodide](https://pyodide.org) (CPython 3.14
compiled to WebAssembly), and your progress lives in IndexedDB.

There are two kinds of problems:

- **Standard problems**: one prompt with visible and hidden tests.
- **Interview simulations**: one problem that evolves through 3-5 stages. You only see the
  current requirement. Passing Submit reveals the next one, your code carries over, and every
  Submit re-runs all earlier stages' tests, so breaking an old requirement shows up as a
  **regression**. A debrief at the end breaks down time, attempts, hints and regressions per stage.

The starter library has **21 standard problems** (hash maps, intervals, heaps, graphs and
topological sort, sliding windows, string parsing, joins, dedupe, aggregation, top-K, one pandas
problem) and **6 simulations**: key-value store, API rate limiter, clickstream event processor,
mini query engine, job scheduler and inventory reservations.

## Features

- Monaco editor with Python highlighting, resizable statement / editor / results panels
- **Run** (visible tests for the current stage) and **Submit** (visible + hidden tests for this and
  every earlier stage), with expected vs actual values, first-difference hints, tracebacks,
  per-test output, and regressions labeled "Stage N test broke"
- Time limits enforced by terminating the Python worker, with a warm spare for instant recovery
- Custom input box (REPL-style: shows the value of the last expression)
- Per-stage timer with Start / Pause / Resume, auto-pause when the tab is hidden, kept across reloads
- Progressive hints, a solution lock with recorded reveals, read-only snapshots of your code at the end of each stage
- Submission history with a Monaco diff against the previous submission
- Markdown notes per problem, autosaved drafts, reset to starter code
- Dashboard: solved counts by difficulty and tag, daily streak, practice time, recent activity, weakest tags
- Import problems from the UI (drag and drop, inline validation errors); export / import all your data
- Dark mode by default, keyboard shortcuts with a cheat sheet (`?`)

| Shortcut                   | Action                        |
| -------------------------- | ----------------------------- |
| `Cmd/Ctrl + Enter`         | Run                           |
| `Cmd/Ctrl + Shift + Enter` | Submit                        |
| `?`                        | Keyboard shortcut cheat sheet |

## Setup

Requirements:

- **Node.js 24** (22.13+ works) and **npm 11**. npm 10.9 crashes resolving this dependency tree
  (`Cannot read properties of null (reading 'edgesOut')`). Upgrade npm, or use `npx npm@11 install`.
- **[uv](https://docs.astral.sh/uv/)** for the Python tooling. It installs Python 3.14 itself.

```bash
npm install
```

```bash
uv sync
```

```bash
npm run dev
```

`npm run dev` and `npm run build` first run `npm run pyodide:assets`. That copies the Pyodide
runtime from `node_modules` into `public/pyodide/` and downloads the wheels for the allowed
packages (numpy, pandas, sortedcontainers; about 8 MB, checksum-verified) once. After that, nothing
is fetched from the network: Pyodide, the wheels and Monaco are all served locally.

`npm install` also installs the git hooks (lefthook).

## Scripts

| Script                                       | What it does                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------ |
| `npm run dev` / `build` / `preview`          | Vite dev server, production build, preview the build                                 |
| `npm run lint` / `lint:fix`                  | ESLint + Prettier + Ruff                                                             |
| `npm run typecheck`                          | `tsc -b --noEmit` over app, tests and Node code                                      |
| `npm test`                                   | Unit + component tests (Vitest)                                                      |
| `npm run test:coverage`                      | The same, with coverage thresholds enforced                                          |
| `npm run test:integration`                   | Runner integration tests with real Pyodide (Node worker threads) and CPython         |
| `npm run test:py`                            | pytest for the Python harness (coverage ≥ 90%, CPython/Pyodide parity)               |
| `npm run test:e2e`                           | Playwright end-to-end tests against the production build (run `npm run build` first) |
| `npm run problem:validate -- <file\|dir>...` | Schema + execution checks for problem files                                          |
| `npm run problem:add -- <file> [--force]`    | Validate a problem and copy it into `problems/<id>.json`                             |
| `npm run schema:types`                       | Regenerate `src/types/problem.generated.ts` from the JSON Schema                     |
| `npm run schema:guide`                       | Re-embed `schema/examples/*.json` into the authoring guide                           |
| `npm run schema:check`                       | Fail if generated types or guide examples are stale (runs in CI)                     |
| `npm run pyodide:assets`                     | Copy Pyodide and download the package wheels into `public/pyodide/`                  |

## Adding problems

Problems are JSON files in [`problems/`](problems), one per problem, validated against
[`schema/problem.schema.json`](schema/problem.schema.json) (JSON Schema 2020-12).

**[`schema/PROBLEM_AUTHORING.md`](schema/PROBLEM_AUTHORING.md)** is a self-contained guide.
Together with the schema, it's all an LLM needs to write new problems: the execution contract,
test and stage design rules, JSON escaping, two complete examples and a ready-to-paste generation
prompt. Then:

```bash
npm run problem:validate -- path/to/new-problem.json
```

```bash
npm run problem:add -- path/to/new-problem.json
```

`problem:validate` runs the schema and semantic checks, then executes every reference solution
with real Python (CPython 3.14, through the same harness the browser uses). It checks that:

- each stage's solution passes that stage's tests and every earlier stage's tests
- every new simulation stage has at least one test that the previous stage's solution fails
- the starter code fails
- everything runs well within the time limit

You can also import a file in the app (**Import** in the header), which applies the schema checks.

## Architecture

```
problems/            problem content (JSON), validated at build time
schema/              JSON Schema, authoring guide, examples, invalid fixtures
harness/             elite_harness.py: one test harness for Pyodide and CPython (+ pytest)
scripts/             CLIs: validate/add problems, type generation, Pyodide assets
src/core/            pure logic: validation, test selection, regressions, progression,
                     timer math, stats, diffs, debrief (no React, no I/O)
src/runner/          CodeRunner interface; PyodideRunner (main thread) and worker handler
src/storage/         Storage interface; Dexie (IndexedDB) and in-memory implementations, backups
src/store/           Zustand app store (library, progress, timers, submissions, settings)
src/features/        UI: problem list, problem page, dashboard, debrief, import, settings
e2e/                 Playwright journeys
```

- **Execution** goes through the `CodeRunner` interface (`src/runner/types.ts`). `PyodideRunner`
  queues runs, starts the time limit once packages are loaded, terminates the worker on timeout,
  and promotes a warm spare. A server-side runner could implement the same interface.
- **Persistence** goes through the `Storage` interface (`src/storage/types.ts`). One contract test
  suite runs against both the Dexie and in-memory implementations.
- **Content is data**: the app only knows the schema. TypeScript types are generated from it, and
  a test fails if they drift.

## Testing strategy

| Layer       | Tooling               | What it covers                                                                                                                                                                                                                                                      |
| ----------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit        | Vitest                | Validation, test selection, regression classification, stage progression, timer math (pause/resume, hidden tab, reload), diffs, streaks and stats, repositories (`fake-indexeddb`), backups, CLI logic, `PyodideRunner` with a scripted fake worker and fake timers |
| Component   | React Testing Library | Problem page panels, results states (pass / fail / regression / timeout / crash / syntax error), hints, solution lock, timer controls, history diff, notes, drafts, import dialog errors, settings and backups, dashboard, debrief                                  |
| Python      | pytest                | Harness results, exceptions, syntax errors, printing tests, infinite loops, unicode, large output, determinism, and identical results under CPython and real Pyodide                                                                                                |
| Integration | Vitest (Node)         | Real Pyodide in real worker threads: timeout recovery, package loading, back-to-back runs. CPython runner and validator against real Python                                                                                                                         |
| Schema      | Vitest                | Every example in the guide validates, and every invalid fixture fails with the expected error                                                                                                                                                                       |
| E2E         | Playwright            | Solve a standard problem; complete a simulation including a regression; timeout recovery; pause/resume and reload; hints and the solution lock; import a problem; export and re-import data                                                                         |

Coverage is enforced at **≥ 90%** for `src/core` and `src/runner` (Vitest) and for the harness
(pytest), and at **≥ 80%** overall. Tests are deterministic: fake timers and injected clocks, no
network, seeded randomness (`random.seed(0)` per test, `PYTHONHASHSEED=0`), and
UTC for date logic.

## Quality gates

**Git hooks** ([`lefthook.yml`](lefthook.yml)):

- `pre-commit`: Prettier, ESLint and Ruff on staged files, plus a typecheck
- `commit-msg`: Conventional Commits via commitlint
- `pre-push`: unit + component tests, pytest, and `problem:validate` when `problems/`, `schema/` or `harness/` changed

**CI** ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs on every pull request and
every push to `main`, as separate jobs: `lint` (including the schema drift check), `typecheck`,
`unit + component tests` (coverage thresholds plus Pyodide integration tests), `pytest`,
`problem validation`, `e2e` (Playwright, with Pyodide assets and browsers cached) and `build`.

## Branch protection

`main` is protected with these settings, applied by
[`scripts/setup-branch-protection.sh`](scripts/setup-branch-protection.sh) through `gh api`:

- Require a pull request before merging (0 approvals, so a solo maintainer can merge; stale
  approvals are dismissed)
- Require status checks to pass: `lint`, `typecheck`, `unit + component tests`, `pytest`,
  `problem validation`, `e2e`, `build`
- Require branches to be up to date before merging (`strict: true`)
- Require conversation resolution; no force pushes; no branch deletion
- `enforce_admins` is **off**, so repository admins can still push directly in an emergency.
  Turn it on in **Settings → Branches** to hold admins to the same rules.

To apply the settings to your fork:

```bash
scripts/setup-branch-protection.sh
```

## Your data

Everything (drafts, submissions, progress, timers, notes, imported problems, settings) is stored
in this browser's IndexedDB. Use **Settings → Export data** to back it up as JSON, and
**Import data** to restore it, for example in another browser. Nothing is sent anywhere.
