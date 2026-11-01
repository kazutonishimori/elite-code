# Elite Code problem authoring guide

This guide and `problem.schema.json` are **everything you need** to write a valid, high-quality
Elite Code problem. You don't need to know how the app is built. Read the guide end to end before
writing your first problem. Section 9 has a ready-made prompt template.

- Format version: **`schemaVersion: 1`**
- Python version: **3.14**
- One problem = one JSON file named `<id>.json`

---

## 1. What Elite Code is, and what makes a good problem

Elite Code is a local practice platform for engineers preparing for **mid-to-senior software
engineer and data engineer interviews**. The solver writes Python in a browser editor and runs it
against tests. There are two kinds of problems:

- **Standard problems:** one prompt with tests, like a classic coding-interview question.
- **Interview simulations:** one problem that evolves through 3-5 stages, the way a real interviewer
  keeps adding requirements ("Nice. Now the product team wants…").

The solver is an experienced engineer. Good problems for this audience:

- **Feel like real work.** Rate limiters, event pipelines, schedulers, ledgers, joins and dedupes
  over records, calendar math, log parsing. Prefer a realistic domain to abstract puzzles ("given
  an array of integers…").
- **Test judgment, not trivia.** The hard part should be choosing the right data structure,
  handling edge cases, and keeping a design extensible. Avoid trick math, obscure algorithms,
  or one-insight puzzles where you either know it or you don't.
- **Are precisely specified.** Every function name, argument, return type, ordering rule, tie-break
  and error behavior the tests rely on is stated in the requirement. A strong engineer should never
  fail a hidden test because of an unstated assumption.
- **Reward good engineering.** Clean decomposition and correct complexity should naturally pass;
  shortcuts (hardcoding examples, quadratic scans on large input, ignoring an edge case) should not.
- **Are sized for an interview.** A standard problem takes 10-40 minutes. A simulation takes
  30-90 minutes in total.

Difficulty calibration for this audience:

| Difficulty | Meaning                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------- |
| `easy`     | One clear idea, few edge cases. A warm-up (~10-15 min).                                           |
| `medium`   | The typical interview question: a standard technique plus careful edge cases (~20-30 min).        |
| `hard`     | Several interacting ideas or a subtle invariant; strong candidates need the full slot (~40+ min). |

---

## 2. Problem types, from the solver's point of view

### Standard (`"type": "standard"`)

Exactly **one stage**. The solver reads the requirement, writes code, and can:

- **Run:** execute the stage's _visible_ tests (and see anything they print).
- **Submit:** execute the visible **and** hidden tests. Passing all of them solves the problem.

### Simulation (`"type": "simulation"`)

**3-5 stages**, revealed one at a time:

1. The solver sees **only the current stage's requirement**. Future stages are hidden, so stage
   1 must make sense on its own and must not hint at what comes next.
2. When the solver passes Submit on a stage, the next requirement is revealed. **Their code carries
   over unchanged** and they extend it.
3. **Tests are cumulative.** Submitting stage _k_ runs every visible and hidden test of stages
   1.._k_. A failing test from an earlier stage is shown as a **regression** ("Stage 2 test broke").
   Each new stage therefore has to stay **backward compatible**: existing function signatures and
   behaviors must keep working.
4. At the end, the solver sees a debrief with every stage's reference solution and explanation.

Consequences for authors:

- New capabilities arrive as **new methods, new optional parameters (with defaults), or new
  constructor options**, never by changing what an existing call returns.
- If a stage changes a rule, the change must be expressed through a new option or method so the
  old tests remain true. Example: an optional `now: int = 0` argument, or `Store(ttl=None)`.
- Each stage's reference solution is the **complete, cumulative program** as it should look at
  the end of that stage.

---

## 3. Field-by-field reference

The schema is the source of truth (`additionalProperties: false` everywhere, so unknown fields are
rejected). This section explains intent and the rules the schema can't express.

### Top level

| Field              | Required | Rules and intent                                                                                                                                                                                                     |
| ------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `$schema`          | no       | Optional path to the schema for editor autocompletion. Ignored.                                                                                                                                                      |
| `schemaVersion`    | yes      | Must be `1`.                                                                                                                                                                                                         |
| `id`               | yes      | Kebab-case slug matching `^[a-z][a-z0-9]*(-[a-z0-9]+)*$`, 2-64 chars. **Globally unique and stable.** The file must be named `<id>.json`. Simulations conventionally end in `-simulation`, but this is not required. |
| `title`            | yes      | 3-80 chars, Title Case.                                                                                                                                                                                              |
| `type`             | yes      | `"standard"` (exactly 1 stage) or `"simulation"` (3-5 stages).                                                                                                                                                       |
| `difficulty`       | yes      | `easy` / `medium` / `hard`. For simulations, rate the final stage.                                                                                                                                                   |
| `tags`             | yes      | 1-5 unique values from the fixed vocabulary in the schema (`$defs.tag`), most important first.                                                                                                                       |
| `summary`          | yes      | 20-300 chars of plain text (no Markdown) for the problem list. Must not reveal the approach or later stages.                                                                                                         |
| `starterCode`      | yes      | The signatures the tests call, with docstrings and `pass` / `raise NotImplementedError` bodies. **Must fail at least one test.** For simulations it covers stage 1 only.                                             |
| `packages`         | no       | Unique values from `numpy`, `pandas`, `sortedcontainers`. Omit for pure Python (strongly preferred: interviews rarely allow libraries).                                                                              |
| `timeLimitSeconds` | no       | 1-30, default 5. Applies to one full run of all selected tests. See section 4.                                                                                                                                       |
| `estimatedMinutes` | yes      | Integer 5-180: a strong candidate's time for the whole problem.                                                                                                                                                      |
| `companies`        | no       | Up to 10 short strings, flavor only.                                                                                                                                                                                 |
| `topics`           | no       | Up to 10 free-form domain words ("payments", "observability").                                                                                                                                                       |
| `stages`           | yes      | Ordered list of stages (see below).                                                                                                                                                                                  |

### Stage (`$defs.stage`)

| Field          | Rules and intent                                                                                                                                                                                                                 |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`           | Kebab-case slug, **unique within the problem** (e.g. `basic-limit`, `per-user-limits`).                                                                                                                                          |
| `title`        | 3-80 chars, e.g. "Per-user limits".                                                                                                                                                                                              |
| `requirement`  | 50-6000 chars of Markdown, in the interviewer's voice. Must define every signature the tests use, formats, ordering, tie-breaks, error behavior and input sizes. Include at least one worked example in a fenced `python` block. |
| `visibleTests` | 1-15 tests the solver can read. Cover the worked example(s) plus a simple edge case.                                                                                                                                             |
| `hiddenTests`  | 1-30 tests run only on Submit. Edge cases, scale, and anti-shortcut checks.                                                                                                                                                      |
| `hints`        | 2-3 **different** Markdown strings, ordered from gentle nudge to near-giveaway. No full code.                                                                                                                                    |
| `solution`     | Reference solution object (below).                                                                                                                                                                                               |

### Test case (`$defs.testCase`)

| Field         | Rules and intent                                                                                                                                                                                         |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`        | Matches `^test_[a-z0-9_]+$`, max 80 chars. **Unique across the entire problem**, all stages and both visible and hidden lists.                                                                           |
| `description` | Optional, 1-200 chars. Shown to the solver when the test is visible or fails.                                                                                                                            |
| `code`        | Python source that **defines a zero-argument function with exactly the name `name`** (`def test_x():` at the start of a line). Imports may appear above it. Nothing else should be defined at top level. |

### Solution (`$defs.solution`)

| Field             | Rules and intent                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `code`            | Complete runnable Python that passes this stage's tests **and every earlier stage's tests**.                             |
| `explanation`     | 50-6000 chars of Markdown: the approach, why it's correct, trade-offs and, for simulations, what was refactored and why. |
| `timeComplexity`  | Big-O time with variables defined, e.g. `O(n log n) for n events`.                                                       |
| `spaceComplexity` | Big-O extra space, e.g. `O(k) for k distinct users`.                                                                     |

### Rules the schema can't express (checked by the validator)

1. Stage `id`s are unique within the problem.
2. Test `name`s are unique across the whole problem.
3. Each test's `code` defines `def <name>():` with no parameters.
4. Hints within a stage are all different.
5. The file name equals `<id>.json`, and no two problems share an `id`.
6. **Execution checks** (section 10): every stage's solution passes all tests of that stage and of
   every earlier stage; the starter code fails at least one test; for simulations, each stage's new
   tests include at least one that **fails** against the previous stage's solution (proof that the
   stage adds something); all of it runs within the time limit.

---

## 4. The execution contract

This is exactly how code runs. Write tests and solutions against this contract.

**Runtime.** Python **3.14**, running in WebAssembly in the browser (via Pyodide), in a single
thread. The validator uses regular CPython 3.14 with the same harness, so behavior is identical.

**Order of execution for one Run or Submit:**

1. The solver's code is executed as a module whose `__name__` is `"solution"` (not `"__main__"`,
   so `if __name__ == "__main__":` blocks do not run). Anything printed here is shown in the
   console. If the code fails to compile or raises at import time, no tests run.
2. The selected tests run **in order**: Run selects the current stage's visible tests; Submit selects
   visible + hidden tests of the current stage **and all earlier stages**, earlier stages first.
3. For each test, its `code` is executed in a **fresh copy of the solver's namespace**. Every
   top-level name the solver defined (functions, classes, constants) is in scope directly, and
   no import is needed. Names the test defines do not leak into other tests. Then:
   - `random.seed(0)` is called,
   - the test function is called with no arguments,
   - it **passes** if it returns without raising; an `AssertionError` makes it **fail**; any other
     exception is reported as an **error** with a traceback.
4. stdout/stderr are captured **per test** and shown next to that test. Output is truncated after
   20,000 characters per stream.

**Assertions.** Write plain `assert actual == expected` with the solver's call on the **left** and
the literal expected value on the **right**. The harness rewrites single comparisons (`==`, `!=`,
`<`, `<=`, `>`, `>=`, `in`, `not in`, `is`, `is not`) to display the expression, the actual value,
the expected value and, for `==` on lists/tuples/strings/dicts, where they first differ. Optional
assert messages (`assert x == y, "why"`) are shown instead of the default message. Avoid chained
comparisons (`a < b < c`) and `assert` inside comprehensions; split them into separate asserts.

**What is in scope / available:**

- The whole Python standard library that works without an OS: `collections`, `heapq`, `bisect`,
  `itertools`, `functools`, `math`, `statistics`, `re`, `json`, `csv` (on `io.StringIO`),
  `datetime`, `zoneinfo` (only UTC is guaranteed), `dataclasses`, `enum`, `typing`, `decimal`,
  `fractions`, `string`, `textwrap`, `copy`, `operator`, `random` (seeded per test).
- Packages listed in the problem's `packages` field, if any: `numpy`, `pandas`, `sortedcontainers`.
  Anything else (e.g. `requests`, `scipy`, `networkx`) is **not available**.

**What is NOT available (never require it in a requirement, test or solution):**

- **Threads and processes:** `threading`/`multiprocessing`/`concurrent.futures` cannot start
  workers; `asyncio` event loops must not be relied on.
- **Network:** no sockets, HTTP or DNS.
- **Filesystem:** don't read or write files. Pass data in as strings, lists or dicts (use
  `io.StringIO` to simulate a file).
- **Keyboard input:** `input()` raises an error. Tests call functions directly.
- **Real time:** don't use `time.time()`, `time.sleep()` or `datetime.now()` for behavior.
- **Environment:** no `sys.argv`, environment variables or subprocesses.

**Modeling time and concurrency.** Anything time-based (TTLs, rate limits, sessions, schedules,
retries with backoff) takes **explicit timestamps as arguments**, usually integers in seconds or
milliseconds: `limiter.allow("u1", now=1000)`, `store.get("k", at=17)`. The requirement states the
unit and the boundary rule (is an entry with `expires_at == now` expired? say so). Model concurrency
as **deterministic interleavings**: explicit transaction ids, an event list processed in order, or
a scheduler that is stepped (`tick()`), never real threads.

**Time limit.** `timeLimitSeconds` (default 5) covers one complete Run or Submit: loading the
solver's code plus every selected test. If it's exceeded, the run is stopped and reported as "time
limit exceeded / possible infinite loop". Browser Python is roughly **2-4× slower than native
CPython**, so make sure the **reference solution's full cumulative Submit takes under ~10% of the
limit on CPython**. Large-input tests should separate O(n log n) from O(n²) at sizes like
n = 10⁴-10⁵, not n = 10⁶.

**Determinism.** Tests must produce the same result on every run: no wall-clock time, no
unseeded randomness (the seed is reset to 0 before each test; build large inputs with arithmetic or
`random.Random(42)`), and never depend on `set` iteration order or `id()`. Compare unordered
results with `sorted(...)` or as sets. Compare floats with `round(x, 6)` or `math.isclose`.

---

## 5. Test-writing rules

1. **Visible tests teach; hidden tests verify.** Visible tests mirror the worked example(s) and one
   simple edge case. Hidden tests carry the real coverage.
2. **Cover edge cases deliberately.** For every stage, think about: empty input; a single element;
   duplicates; ties (and the stated tie-break); boundary values (`0`, negatives, the exact
   expiry instant, maximum sizes); unknown keys or ids; invalid arguments, if the requirement
   specifies errors (test the exact exception type with `try/except`/`else: raise AssertionError`);
   unicode strings where text is involved.
3. **Catch shortcuts.** Include at least one hidden test that a hardcoded or naive solution fails:
   a large input within the time limit (quadratic times out, `n log n` passes), inputs in a different
   order than the examples, and a check that inputs are not mutated when the requirement says so.
4. **One behavior per test**, with a descriptive name (`test_expired_entry_not_returned`, not
   `test_3`). A few asserts per test are fine when they tell one story.
5. **Construct fresh objects in every test.** Never rely on state from another test.
6. **Never change earlier tests** when adding a stage. A new stage only **adds** tests. Earlier
   tests are the backward-compatibility contract, and changing them would hide regressions.
7. **Each new stage must add at least one test that the previous stage's reference solution fails.**
   Otherwise the stage doesn't add anything.
8. **Make expected values obviously right.** Use literals, or a tiny brute-force oracle
   _inside the test_ for large inputs (e.g. compare against a simple O(n²) check on n = 300).
9. **Exact names.** Tests must only call names and signatures the requirement defines.
10. **Keep tests fast.** Each test should normally run in milliseconds. Reserve one or two tests per
    stage for scale.

Testing an exception:

```python
def test_rejects_negative_amount():
    account = Account("a1")
    try:
        account.deposit(-5)
    except ValueError:
        pass
    else:
        raise AssertionError("deposit(-5) should raise ValueError")
```

---

## 6. Stage design rules (simulations)

1. **3-5 stages**, typically 4. Stage 1 is approachable (~10 minutes). Difficulty ramps up, and the
   last stage is the hardest.
2. **Each stage forces a realistic refactor, not a bolt-on.** A good stage invalidates an
   assumption the solver probably made. Examples: a global counter must become per-key state; a
   list scan must become a heap or an index; a single value must become a history; mutations must
   become transactional. If the new requirement can be satisfied by appending an unrelated
   function, redesign the stage.
3. **Interviewer tone.** Write as the interviewer speaking to the candidate: "Let's start
   simple…", "Nice. Now the product team wants…", "Last one: …". State the new rules precisely
   right after the conversational opener.
4. **Backward compatible by construction.** New behavior arrives through new methods, new optional
   parameters with defaults that preserve old behavior, or new constructor options.
5. **No spoilers.** Stage _k_ never mentions what stage _k+1_ will ask. Starter code covers stage 1
   only; the solver adds new methods themselves when the requirement asks for them.
6. **Self-contained requirements.** Each stage's requirement restates the signatures it adds and
   the rules it changes. Assume the solver can still read earlier stages, but don't make them
   cross-reference half-remembered details.
7. **Classic arcs that work well:** key-value store → TTL → transactions → nested transactions;
   rate limiter → per-user limits → sliding window → burst allowance; ledger → transfers →
   scheduled payments → account merges; event processor → sessionization → late events → dedupe;
   query engine → filter/select → group-by → joins; job scheduler → dependencies → retries with
   backoff → priorities.

---

## 7. Embedding Python in JSON strings

Code lives inside JSON strings, so it must be escaped:

| Character        | Write it as                                                                  |
| ---------------- | ---------------------------------------------------------------------------- |
| newline          | `\n`                                                                         |
| double quote `"` | `\"`. Inside Python code prefer single quotes `'...'` when it doesn't matter |
| backslash `\`    | `\\` (so a Python `"\n"` string literal becomes `"\\n"` in JSON)             |
| tab              | never use tabs: indent Python with **4 spaces**                              |

Rules:

- Every code string should end with a single `\n`.
- Indentation is significant: count the spaces after each `\n` carefully.
- Don't put raw line breaks inside a JSON string; that's invalid JSON.
- Markdown fields (requirements, hints, explanations) also use `\n` for line breaks and `\n\n`
  between paragraphs. Fenced code blocks inside Markdown work normally: write them as
  ` ```python\n...\n``` `.
- Unicode is fine as-is (UTF-8). You don't need `\u` escapes.

Example: this Python test

```python
def test_parses_quoted_field():
    assert parse_line('a,"b,c"') == ["a", "b,c"]
```

becomes this JSON string:

```json
"def test_parses_quoted_field():\n    assert parse_line('a,\"b,c\"') == [\"a\", \"b,c\"]\n"
```

---

## 8. Complete examples

Both examples below are valid and pass every execution check.

### 8.1 Standard problem

<!-- BEGIN EXAMPLE merge-meeting-ranges -->

````json
{
  "schemaVersion": 1,
  "id": "merge-meeting-ranges",
  "title": "Merge Meeting Ranges",
  "type": "standard",
  "difficulty": "medium",
  "tags": ["intervals", "sorting"],
  "summary": "Collapse a calendar export's overlapping meeting ranges into the minimal set of busy blocks.",
  "starterCode": "def merge_ranges(ranges: list[tuple[int, int]]) -> list[tuple[int, int]]:\n    \"\"\"Return the merged busy blocks, sorted by start.\"\"\"\n    raise NotImplementedError\n",
  "estimatedMinutes": 15,
  "companies": ["Calendly", "Google"],
  "topics": ["calendars"],
  "stages": [
    {
      "id": "merge-ranges",
      "title": "Merge overlapping ranges",
      "requirement": "We export everyone's meetings as `(start, end)` pairs of minutes since midnight, with\n`start < end`. The list is unsorted and can contain duplicates. Write\n`merge_ranges(ranges)` returning the minimal list of busy blocks, sorted by start.\n\nRanges that overlap **or touch** merge: `(60, 90)` and `(90, 120)` become `(60, 120)`.\nReturn tuples, and return `[]` for an empty input. Don't mutate the input list.\n\n```python\nmerge_ranges([(540, 600), (570, 630), (700, 720)])\n# -> [(540, 630), (700, 720)]\n```\n\nUp to 100,000 ranges.",
      "visibleTests": [
        {
          "name": "test_example",
          "description": "The worked example from the prompt.",
          "code": "def test_example():\n    assert merge_ranges([(540, 600), (570, 630), (700, 720)]) == [(540, 630), (700, 720)]\n"
        },
        {
          "name": "test_touching_ranges_merge",
          "code": "def test_touching_ranges_merge():\n    assert merge_ranges([(60, 90), (90, 120)]) == [(60, 120)]\n"
        },
        {
          "name": "test_empty",
          "code": "def test_empty():\n    assert merge_ranges([]) == []\n"
        }
      ],
      "hiddenTests": [
        {
          "name": "test_unsorted_input",
          "code": "def test_unsorted_input():\n    assert merge_ranges([(700, 720), (10, 20), (15, 30)]) == [(10, 30), (700, 720)]\n"
        },
        {
          "name": "test_contained_range",
          "description": "A range fully inside another must not shrink the block.",
          "code": "def test_contained_range():\n    assert merge_ranges([(0, 100), (10, 20), (30, 40)]) == [(0, 100)]\n"
        },
        {
          "name": "test_duplicates",
          "code": "def test_duplicates():\n    assert merge_ranges([(5, 9), (5, 9), (5, 9)]) == [(5, 9)]\n"
        },
        {
          "name": "test_does_not_mutate_input",
          "code": "def test_does_not_mutate_input():\n    ranges = [(30, 40), (10, 20)]\n    merge_ranges(ranges)\n    assert ranges == [(30, 40), (10, 20)]\n"
        },
        {
          "name": "test_returns_tuples",
          "code": "def test_returns_tuples():\n    assert all(isinstance(r, tuple) for r in merge_ranges([(1, 2), (5, 6)]))\n"
        },
        {
          "name": "test_large_input",
          "description": "100k disjoint ranges in reverse order: needs O(n log n).",
          "code": "def test_large_input():\n    ranges = [(i * 3, i * 3 + 2) for i in range(100_000)][::-1]\n    merged = merge_ranges(ranges)\n    assert len(merged) == 100_000\n    assert merged[0] == (0, 2)\n"
        }
      ],
      "hints": [
        "If the ranges were sorted by start, which ranges could possibly overlap the one you are looking at?",
        "Sort by start, then sweep once, keeping the current block. Either extend it or start a new one.",
        "A range extends the current block when `start <= current_end`. The new end is `max(current_end, end)`, not just `end`."
      ],
      "solution": {
        "code": "def merge_ranges(ranges: list[tuple[int, int]]) -> list[tuple[int, int]]:\n    merged: list[tuple[int, int]] = []\n    for start, end in sorted(ranges):\n        if merged and start <= merged[-1][1]:\n            merged[-1] = (merged[-1][0], max(merged[-1][1], end))\n        else:\n            merged.append((start, end))\n    return merged\n",
        "explanation": "Sort by start (`sorted` copies, so the input is untouched). After sorting, a range can\nonly overlap the block currently being built. So one sweep is enough: if the next range\nstarts at or before the block's end, extend the block with `max` (the next range might\nsit entirely inside it). Otherwise close the block and start a new one.",
        "timeComplexity": "O(n log n) for n ranges (the sort dominates)",
        "spaceComplexity": "O(n) for the sorted copy and output"
      }
    }
  ]
}
````

<!-- END EXAMPLE -->

### 8.2 Four-stage simulation

<!-- BEGIN EXAMPLE inventory-reservations -->

````json
{
  "schemaVersion": 1,
  "id": "inventory-reservations",
  "title": "Inventory Reservations",
  "type": "simulation",
  "difficulty": "medium",
  "tags": ["design", "hash-map", "simulation"],
  "summary": "Build the stock-keeping core of an online store, then grow it as the interviewer adds requirements.",
  "starterCode": "class Inventory:\n    def __init__(self):\n        pass\n\n    def add(self, sku: str, qty: int) -> None:\n        pass\n\n    def remove(self, sku: str, qty: int) -> bool:\n        pass\n\n    def count(self, sku: str) -> int:\n        pass\n",
  "estimatedMinutes": 45,
  "companies": ["Shopify", "Amazon"],
  "topics": ["e-commerce"],
  "stages": [
    {
      "id": "basic-stock",
      "title": "Basic stock",
      "requirement": "Let's start simple. We're building the inventory service for a store. Implement a class\n`Inventory` with:\n\n- `add(sku, qty)`: adds `qty` units of `sku`.\n- `remove(sku, qty) -> bool`: removes `qty` units if at least that many are in stock and\n  returns `True`. Otherwise changes nothing and returns `False`.\n- `count(sku) -> int`: units in stock, `0` for unknown SKUs.\n\n`qty` must be a positive integer; raise `ValueError` otherwise.\n\n```python\ninv = Inventory()\ninv.add(\"mug\", 3)\ninv.remove(\"mug\", 5)  # False\ninv.remove(\"mug\", 2)  # True\ninv.count(\"mug\")      # 1\n```",
      "visibleTests": [
        {
          "name": "test_add_and_count",
          "code": "def test_add_and_count():\n    inv = Inventory()\n    inv.add(\"mug\", 3)\n    inv.add(\"mug\", 2)\n    assert inv.count(\"mug\") == 5\n"
        },
        {
          "name": "test_remove_insufficient_stock",
          "code": "def test_remove_insufficient_stock():\n    inv = Inventory()\n    inv.add(\"mug\", 3)\n    assert inv.remove(\"mug\", 5) is False\n    assert inv.count(\"mug\") == 3\n"
        }
      ],
      "hiddenTests": [
        {
          "name": "test_unknown_sku_is_zero",
          "code": "def test_unknown_sku_is_zero():\n    assert Inventory().count(\"nope\") == 0\n"
        },
        {
          "name": "test_remove_exact_amount",
          "code": "def test_remove_exact_amount():\n    inv = Inventory()\n    inv.add(\"mug\", 2)\n    assert inv.remove(\"mug\", 2) is True\n    assert inv.count(\"mug\") == 0\n"
        },
        {
          "name": "test_invalid_qty_raises",
          "code": "def test_invalid_qty_raises():\n    inv = Inventory()\n    for bad in (0, -1):\n        try:\n            inv.add(\"mug\", bad)\n        except ValueError:\n            pass\n        else:\n            raise AssertionError(f\"add({bad}) should raise ValueError\")\n"
        }
      ],
      "hints": [
        "A dictionary from SKU to quantity is all you need for now.",
        "Check the stock before mutating in `remove`, so a failed removal changes nothing."
      ],
      "solution": {
        "code": "class Inventory:\n    def __init__(self):\n        self._stock: dict[str, int] = {}\n\n    def add(self, sku: str, qty: int) -> None:\n        if qty <= 0:\n            raise ValueError(\"qty must be positive\")\n        self._stock[sku] = self._stock.get(sku, 0) + qty\n\n    def remove(self, sku: str, qty: int) -> bool:\n        if qty <= 0:\n            raise ValueError(\"qty must be positive\")\n        if self._stock.get(sku, 0) < qty:\n            return False\n        self._stock[sku] -= qty\n        return True\n\n    def count(self, sku: str) -> int:\n        return self._stock.get(sku, 0)\n",
        "explanation": "A `dict[str, int]` maps SKU to units. `remove` checks the stock first so a failed call\nis a no-op. Validating `qty` up front keeps bad data out of the store.",
        "timeComplexity": "O(1) per operation",
        "spaceComplexity": "O(k) for k distinct SKUs"
      }
    },
    {
      "id": "reservations",
      "title": "Reservations",
      "requirement": "Nice. Checkout needs to hold stock while the customer pays. Add:\n\n- `reserve(order_id, sku, qty) -> bool`: holds `qty` units for an order. It fails (returns\n  `False`, nothing changes) if fewer than `qty` units are *available* or the `order_id`\n  already has a reservation.\n- `available(sku) -> int`: stock minus units held by reservations.\n- `cancel(order_id) -> bool`: releases a reservation. `False` if there isn't one.\n- `fulfill(order_id) -> bool`: ships it, so the reserved units leave stock. `False` if\n  there isn't one.\n\n`count` still reports physical stock, reserved units included. And `remove` must not take\nreserved units: it can only remove what's available.\n\n```python\ninv = Inventory()\ninv.add(\"mug\", 5)\ninv.reserve(\"o1\", \"mug\", 3)  # True\ninv.available(\"mug\")         # 2\ninv.remove(\"mug\", 3)         # False: only 2 are free\ninv.fulfill(\"o1\")            # True\ninv.count(\"mug\")             # 2\n```",
      "visibleTests": [
        {
          "name": "test_reserve_reduces_available",
          "code": "def test_reserve_reduces_available():\n    inv = Inventory()\n    inv.add(\"mug\", 5)\n    assert inv.reserve(\"o1\", \"mug\", 3) is True\n    assert inv.available(\"mug\") == 2\n    assert inv.count(\"mug\") == 5\n"
        },
        {
          "name": "test_fulfill_removes_stock",
          "code": "def test_fulfill_removes_stock():\n    inv = Inventory()\n    inv.add(\"mug\", 5)\n    inv.reserve(\"o1\", \"mug\", 3)\n    assert inv.fulfill(\"o1\") is True\n    assert inv.count(\"mug\") == 2\n    assert inv.available(\"mug\") == 2\n"
        }
      ],
      "hiddenTests": [
        {
          "name": "test_remove_cannot_take_reserved_units",
          "code": "def test_remove_cannot_take_reserved_units():\n    inv = Inventory()\n    inv.add(\"mug\", 5)\n    inv.reserve(\"o1\", \"mug\", 3)\n    assert inv.remove(\"mug\", 3) is False\n    assert inv.remove(\"mug\", 2) is True\n"
        },
        {
          "name": "test_cancel_releases",
          "code": "def test_cancel_releases():\n    inv = Inventory()\n    inv.add(\"mug\", 1)\n    inv.reserve(\"o1\", \"mug\", 1)\n    assert inv.cancel(\"o1\") is True\n    assert inv.available(\"mug\") == 1\n    assert inv.cancel(\"o1\") is False\n"
        },
        {
          "name": "test_duplicate_order_id_rejected",
          "code": "def test_duplicate_order_id_rejected():\n    inv = Inventory()\n    inv.add(\"mug\", 10)\n    assert inv.reserve(\"o1\", \"mug\", 1) is True\n    assert inv.reserve(\"o1\", \"mug\", 1) is False\n    assert inv.available(\"mug\") == 9\n"
        },
        {
          "name": "test_fulfill_unknown_order",
          "code": "def test_fulfill_unknown_order():\n    assert Inventory().fulfill(\"ghost\") is False\n"
        }
      ],
      "hints": [
        "Physical stock and held stock are now different numbers. Which methods should use which?",
        "Keep reservations in their own map from `order_id` to `(sku, qty)`. Then `available` is stock minus the sum of holds for that SKU.",
        "`remove` needs to check `available`, not `count`. That's the backward-compatible refactor in this stage."
      ],
      "solution": {
        "code": "class Inventory:\n    def __init__(self):\n        self._stock: dict[str, int] = {}\n        self._reservations: dict[str, tuple[str, int]] = {}  # order_id -> (sku, qty)\n\n    def _reserved(self, sku: str) -> int:\n        return sum(q for s, q in self._reservations.values() if s == sku)\n\n    def add(self, sku: str, qty: int) -> None:\n        if qty <= 0:\n            raise ValueError(\"qty must be positive\")\n        self._stock[sku] = self._stock.get(sku, 0) + qty\n\n    def available(self, sku: str) -> int:\n        return self._stock.get(sku, 0) - self._reserved(sku)\n\n    def remove(self, sku: str, qty: int) -> bool:\n        if qty <= 0:\n            raise ValueError(\"qty must be positive\")\n        if self.available(sku) < qty:\n            return False\n        self._stock[sku] -= qty\n        return True\n\n    def count(self, sku: str) -> int:\n        return self._stock.get(sku, 0)\n\n    def reserve(self, order_id: str, sku: str, qty: int) -> bool:\n        if qty <= 0:\n            raise ValueError(\"qty must be positive\")\n        if order_id in self._reservations or self.available(sku) < qty:\n            return False\n        self._reservations[order_id] = (sku, qty)\n        return True\n\n    def cancel(self, order_id: str) -> bool:\n        return self._reservations.pop(order_id, None) is not None\n\n    def fulfill(self, order_id: str) -> bool:\n        res = self._reservations.pop(order_id, None)\n        if res is None:\n            return False\n        sku, qty = res\n        self._stock[sku] -= qty\n        return True\n",
        "explanation": "Reservations get their own map, `order_id -> (sku, qty)`, separate from physical stock.\n`available` derives the free units, and `remove` and `reserve` now check it instead of\nraw stock. `fulfill` turns a hold into a stock decrement. `count` is unchanged, so the\nstage 1 tests keep passing.",
        "timeComplexity": "O(r) for available/reserve with r active reservations; O(1) otherwise",
        "spaceComplexity": "O(k + r)"
      }
    },
    {
      "id": "expiring-holds",
      "title": "Expiring holds",
      "requirement": "Customers abandon carts, and holds lock up stock forever. The constructor now takes an\noptional `reservation_ttl` (seconds). Every method that can be affected now accepts an\noptional keyword `now: int = 0`, the current time in seconds.\n\nA reservation made at time `t` expires at `t + reservation_ttl`: from that instant on it\nno longer counts against `available` and can't be cancelled or fulfilled.\n`Inventory()` with no TTL behaves exactly as before.\n\n```python\ninv = Inventory(reservation_ttl=60)\ninv.add(\"mug\", 1)\ninv.reserve(\"o1\", \"mug\", 1, now=0)\ninv.available(\"mug\", now=59)  # 0\ninv.available(\"mug\", now=60)  # 1\ninv.fulfill(\"o1\", now=61)     # False\n```",
      "visibleTests": [
        {
          "name": "test_hold_expires_at_ttl",
          "code": "def test_hold_expires_at_ttl():\n    inv = Inventory(reservation_ttl=60)\n    inv.add(\"mug\", 1)\n    assert inv.reserve(\"o1\", \"mug\", 1, now=0)\n    assert inv.available(\"mug\", now=59) == 0\n    assert inv.available(\"mug\", now=60) == 1\n"
        },
        {
          "name": "test_cannot_fulfill_expired",
          "code": "def test_cannot_fulfill_expired():\n    inv = Inventory(reservation_ttl=60)\n    inv.add(\"mug\", 1)\n    inv.reserve(\"o1\", \"mug\", 1, now=0)\n    assert inv.fulfill(\"o1\", now=61) is False\n    assert inv.count(\"mug\") == 1\n"
        }
      ],
      "hiddenTests": [
        {
          "name": "test_no_ttl_never_expires",
          "code": "def test_no_ttl_never_expires():\n    inv = Inventory()\n    inv.add(\"mug\", 1)\n    inv.reserve(\"o1\", \"mug\", 1, now=0)\n    assert inv.available(\"mug\", now=10**9) == 0\n"
        },
        {
          "name": "test_expired_order_id_can_be_reused",
          "code": "def test_expired_order_id_can_be_reused():\n    inv = Inventory(reservation_ttl=10)\n    inv.add(\"mug\", 2)\n    inv.reserve(\"o1\", \"mug\", 1, now=0)\n    assert inv.reserve(\"o1\", \"mug\", 2, now=10) is True\n"
        },
        {
          "name": "test_expiry_frees_stock_for_remove",
          "code": "def test_expiry_frees_stock_for_remove():\n    inv = Inventory(reservation_ttl=5)\n    inv.add(\"mug\", 3)\n    inv.reserve(\"o1\", \"mug\", 3, now=0)\n    assert inv.remove(\"mug\", 1, now=4) is False\n    assert inv.remove(\"mug\", 3, now=5) is True\n"
        }
      ],
      "hints": [
        "A reservation now needs to remember when it was made.",
        "Before any method reads reservations, drop the ones that have expired at `now`. A small `_expire(now)` helper keeps that in one place.",
        "Default `now` to 0 and the TTL to `None` (never expire) so the earlier stages' calls keep working."
      ],
      "solution": {
        "code": "class Inventory:\n    def __init__(self, reservation_ttl: int | None = None):\n        self._ttl = reservation_ttl\n        self._stock: dict[str, int] = {}\n        # order_id -> (sku, qty, created_at)\n        self._reservations: dict[str, tuple[str, int, int]] = {}\n\n    def _expire(self, now: int) -> None:\n        if self._ttl is None:\n            return\n        expired = [o for o, (_, _, t) in self._reservations.items() if now >= t + self._ttl]\n        for order_id in expired:\n            del self._reservations[order_id]\n\n    def _reserved(self, sku: str) -> int:\n        return sum(q for s, q, _ in self._reservations.values() if s == sku)\n\n    def add(self, sku: str, qty: int, now: int = 0) -> None:\n        if qty <= 0:\n            raise ValueError(\"qty must be positive\")\n        self._stock[sku] = self._stock.get(sku, 0) + qty\n\n    def available(self, sku: str, now: int = 0) -> int:\n        self._expire(now)\n        return self._stock.get(sku, 0) - self._reserved(sku)\n\n    def remove(self, sku: str, qty: int, now: int = 0) -> bool:\n        if qty <= 0:\n            raise ValueError(\"qty must be positive\")\n        if self.available(sku, now) < qty:\n            return False\n        self._stock[sku] -= qty\n        return True\n\n    def count(self, sku: str) -> int:\n        return self._stock.get(sku, 0)\n\n    def reserve(self, order_id: str, sku: str, qty: int, now: int = 0) -> bool:\n        if qty <= 0:\n            raise ValueError(\"qty must be positive\")\n        self._expire(now)\n        if order_id in self._reservations or self.available(sku, now) < qty:\n            return False\n        self._reservations[order_id] = (sku, qty, now)\n        return True\n\n    def cancel(self, order_id: str, now: int = 0) -> bool:\n        self._expire(now)\n        return self._reservations.pop(order_id, None) is not None\n\n    def fulfill(self, order_id: str, now: int = 0) -> bool:\n        self._expire(now)\n        res = self._reservations.pop(order_id, None)\n        if res is None:\n            return False\n        sku, qty, _ = res\n        self._stock[sku] -= qty\n        return True\n",
        "explanation": "Each reservation now also stores its creation time. A private `_expire(now)` helper\npurges expired holds and runs at the start of every method that reads reservations,\nso expiry is applied lazily and consistently. Using keyword defaults (`now=0`, TTL\n`None`) keeps the stage 1 and 2 call sites valid. That backward compatibility is the\npoint of this stage.",
        "timeComplexity": "O(r) per operation for r active reservations",
        "spaceComplexity": "O(k + r)"
      }
    },
    {
      "id": "atomic-batches",
      "title": "Atomic batches",
      "requirement": "Last one. The warehouse sends batches of operations that must apply **all or nothing**.\nAdd `apply(ops, now=0) -> bool`, where each op is a tuple of a method name followed by\nits positional arguments:\n\n```python\ninv.apply([\n    (\"add\", \"mug\", 5),\n    (\"reserve\", \"o1\", \"mug\", 2),\n    (\"fulfill\", \"o1\"),\n])  # True\n```\n\nIf any op fails (returns `False`, raises `ValueError`, or names an unknown operation),\n`apply` returns `False` and the inventory must look exactly as it did before the call.\nOps apply in order, so later ops see the effects of earlier ones.",
      "visibleTests": [
        {
          "name": "test_successful_batch",
          "code": "def test_successful_batch():\n    inv = Inventory()\n    assert inv.apply([(\"add\", \"mug\", 5), (\"reserve\", \"o1\", \"mug\", 2), (\"fulfill\", \"o1\")]) is True\n    assert inv.count(\"mug\") == 3\n"
        },
        {
          "name": "test_failed_batch_rolls_back",
          "code": "def test_failed_batch_rolls_back():\n    inv = Inventory()\n    inv.add(\"mug\", 1)\n    assert inv.apply([(\"add\", \"mug\", 5), (\"remove\", \"mug\", 100)]) is False\n    assert inv.count(\"mug\") == 1\n"
        }
      ],
      "hiddenTests": [
        {
          "name": "test_rollback_restores_reservations",
          "code": "def test_rollback_restores_reservations():\n    inv = Inventory()\n    inv.add(\"mug\", 5)\n    inv.reserve(\"keep\", \"mug\", 1)\n    assert inv.apply([(\"cancel\", \"keep\"), (\"reserve\", \"o2\", \"mug\", 99)]) is False\n    assert inv.available(\"mug\") == 4\n    assert inv.cancel(\"keep\") is True\n"
        },
        {
          "name": "test_unknown_op_fails",
          "code": "def test_unknown_op_fails():\n    inv = Inventory()\n    assert inv.apply([(\"add\", \"mug\", 1), (\"teleport\", \"mug\")]) is False\n    assert inv.count(\"mug\") == 0\n"
        },
        {
          "name": "test_invalid_qty_in_batch_fails",
          "code": "def test_invalid_qty_in_batch_fails():\n    inv = Inventory()\n    assert inv.apply([(\"add\", \"mug\", 2), (\"add\", \"cup\", 0)]) is False\n    assert inv.count(\"mug\") == 0\n"
        },
        {
          "name": "test_empty_batch_succeeds",
          "code": "def test_empty_batch_succeeds():\n    assert Inventory().apply([]) is True\n"
        },
        {
          "name": "test_batch_respects_ttl",
          "code": "def test_batch_respects_ttl():\n    inv = Inventory(reservation_ttl=10)\n    inv.add(\"mug\", 1)\n    inv.reserve(\"o1\", \"mug\", 1, now=0)\n    assert inv.apply([(\"fulfill\", \"o1\")], now=10) is False\n    assert inv.count(\"mug\") == 1\n"
        }
      ],
      "hints": [
        "The simplest correct rollback is to restore a snapshot of all state taken before the batch.",
        "Copy both the stock map and the reservations map, run the ops in order, and put the copies back if anything fails.",
        "Treat an exception (unknown op, bad quantity) the same as an op returning `False`."
      ],
      "solution": {
        "code": "class Inventory:\n    def __init__(self, reservation_ttl: int | None = None):\n        self._ttl = reservation_ttl\n        self._stock: dict[str, int] = {}\n        # order_id -> (sku, qty, created_at)\n        self._reservations: dict[str, tuple[str, int, int]] = {}\n\n    def _expire(self, now: int) -> None:\n        if self._ttl is None:\n            return\n        expired = [o for o, (_, _, t) in self._reservations.items() if now >= t + self._ttl]\n        for order_id in expired:\n            del self._reservations[order_id]\n\n    def _reserved(self, sku: str) -> int:\n        return sum(q for s, q, _ in self._reservations.values() if s == sku)\n\n    def add(self, sku: str, qty: int, now: int = 0) -> None:\n        if qty <= 0:\n            raise ValueError(\"qty must be positive\")\n        self._stock[sku] = self._stock.get(sku, 0) + qty\n\n    def available(self, sku: str, now: int = 0) -> int:\n        self._expire(now)\n        return self._stock.get(sku, 0) - self._reserved(sku)\n\n    def remove(self, sku: str, qty: int, now: int = 0) -> bool:\n        if qty <= 0:\n            raise ValueError(\"qty must be positive\")\n        if self.available(sku, now) < qty:\n            return False\n        self._stock[sku] -= qty\n        return True\n\n    def count(self, sku: str) -> int:\n        return self._stock.get(sku, 0)\n\n    def reserve(self, order_id: str, sku: str, qty: int, now: int = 0) -> bool:\n        if qty <= 0:\n            raise ValueError(\"qty must be positive\")\n        self._expire(now)\n        if order_id in self._reservations or self.available(sku, now) < qty:\n            return False\n        self._reservations[order_id] = (sku, qty, now)\n        return True\n\n    def cancel(self, order_id: str, now: int = 0) -> bool:\n        self._expire(now)\n        return self._reservations.pop(order_id, None) is not None\n\n    def apply(self, ops: list[tuple], now: int = 0) -> bool:\n        \"\"\"Apply ops atomically: all succeed, or the inventory is left unchanged.\"\"\"\n        handlers = {\n            \"add\": lambda a: self.add(*a, now=now) is None,\n            \"remove\": lambda a: self.remove(*a, now=now),\n            \"reserve\": lambda a: self.reserve(*a, now=now),\n            \"cancel\": lambda a: self.cancel(*a, now=now),\n            \"fulfill\": lambda a: self.fulfill(*a, now=now),\n        }\n        self._expire(now)\n        snapshot = (dict(self._stock), dict(self._reservations))\n        try:\n            ok = all(handlers[op[0]](op[1:]) for op in ops)\n        except (KeyError, ValueError, TypeError):\n            ok = False\n        if not ok:\n            self._stock, self._reservations = snapshot\n        return ok\n\n    def fulfill(self, order_id: str, now: int = 0) -> bool:\n        self._expire(now)\n        res = self._reservations.pop(order_id, None)\n        if res is None:\n            return False\n        sku, qty, _ = res\n        self._stock[sku] -= qty\n        return True\n",
        "explanation": "`apply` snapshots both maps, runs each op through a dispatch table, and restores the\nsnapshot on the first failure or exception. Shallow copies are enough because the\nvalues are immutable ints and tuples. In an interview, mention the trade-off: snapshots\ncost O(state) per batch. An undo log of inverse operations would cost O(batch) instead,\nbut it's more code and easier to get wrong.",
        "timeComplexity": "O(k + r + b) per batch of b ops (the snapshot copies all state)",
        "spaceComplexity": "O(k + r) for the snapshot"
      }
    }
  ]
}
````

<!-- END EXAMPLE -->

---

## 9. Generation prompt template

Paste this into an LLM, followed by this entire guide and the full contents of
`problem.schema.json`. Fill in the `{placeholders}`.

```text
You are writing a practice problem for Elite Code, an interview-prep platform for
mid-to-senior software and data engineers. Using the JSON Schema and the authoring guide
below, write ONE problem as a single JSON document.

Problem brief:
- Topic / scenario: {topic, e.g. "deduplicating a clickstream with late-arriving events"}
- Type: {standard | simulation with N stages (3-5)}
- Difficulty: {easy | medium | hard}
- Tags (from the schema vocabulary): {tags}
- Packages: {none (preferred) | numpy | pandas | sortedcontainers}
- Anything else: {optional constraints, e.g. "stage 3 should introduce time-based expiry"}

Requirements:
1. Follow the schema exactly: schemaVersion 1, no extra properties, all required fields.
2. Follow every rule in the guide, especially section 4 (execution contract: Python 3.14,
   plain assert-based test_* functions, no threads/network/files/input(), explicit timestamps
   for time), section 5 (test rules) and section 6 (stage design).
3. The requirement for each stage must fully specify every signature, ordering, tie-break,
   boundary and error behavior that the tests check, and include a worked example.
4. Each stage needs 2-5 visible tests, 4-10 hidden tests (edge cases + at least one scale or
   anti-shortcut test), 2-3 progressive hints, and a complete cumulative reference solution
   with an explanation and time/space complexity.
5. For simulations: tests are cumulative and must never change between stages; each stage
   must add at least one test the previous stage's solution fails; new behavior must be
   backward compatible (new methods or optional parameters with defaults).
6. The starter code must contain only the stage-1 signatures and must fail the tests.
7. Before answering, mentally run every test against every reference solution, including all
   earlier stages' tests against later solutions.
8. Escape the JSON correctly (section 7): \n for newlines, \" for quotes, 4-space indentation.

Output ONLY the JSON document, with no commentary and no Markdown fences. The file will be
saved as <id>.json.
```

---

## 10. Validating and importing a generated file

From the Elite Code project directory:

```bash
# Validate one file or a whole directory: schema checks, then every reference solution
# is executed against its tests with real Python.
npm run problem:validate -- path/to/new-problem.json

# Validate and copy it into the library (problems/<id>.json).
npm run problem:add -- path/to/new-problem.json
```

You can also import a file from the app: open **Import**, drop the JSON file in, and fix any
errors listed inline. The app runs the schema checks. The CLI additionally runs the execution
checks, so prefer the CLI for new content.

The validator checks, in order:

1. **Schema:** structure, types, enums, patterns, lengths.
2. **Semantic rules:** section 3, "Rules the schema can't express".
3. **Execution:** for each stage _k_, the stage-_k_ solution passes every test of stages 1.._k_.
   For _k_ > 1, at least one of stage _k_'s tests fails against the stage _k-1_ solution. The
   starter code fails at least one test. Everything finishes within the time limit (with a warning
   when the CPython run uses more than 25% of it).

### Common errors and fixes

| Error message (abridged)                                            | Cause                                                       | Fix                                                                                         |
| ------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `(root): invalid JSON: …`                                           | Raw newline in a string, trailing comma, unescaped `"`      | Apply section 7. Use `\n`, escape quotes, remove trailing commas.                           |
| `(root): unknown property "author"`                                 | A field not in the schema                                   | Remove it. Use `topics`/`companies` for flavor.                                             |
| `(root): missing required property "summary"`                       | Required field omitted                                      | Add it. Check the top-level table in section 3.                                             |
| `/id: must match pattern …`                                         | Uppercase, underscores, spaces                              | Use lowercase kebab-case: `merge-intervals`.                                                |
| `/tags/1: must be one of: …`                                        | Tag outside the vocabulary                                  | Pick the closest tag from `$defs.tag`.                                                      |
| `/packages/0: must be one of: …`                                    | Unsupported package                                         | Rewrite in pure Python, or use numpy/pandas/sortedcontainers.                               |
| `/stages: must NOT have more than 1 items`                          | Standard problem with several stages                        | Make it a `simulation` or merge the stages.                                                 |
| `/stages: must NOT have fewer than 3 items`                         | Simulation with fewer than 3 stages                         | Add stages or make it `standard`.                                                           |
| `/stages/0/hints: must NOT have fewer than 2 items`                 | Only one hint                                               | Write 2-3 progressive hints.                                                                |
| `…/name: must match pattern ^test_[a-z0-9_]+$`                      | Test named `testFoo` or `test-foo`                          | Rename to `test_foo` **and** rename the `def` in `code`.                                    |
| `…/code: code must define a zero-argument function "def test_x():"` | `name` and `def` disagree, or the function takes parameters | Make the `def` match `name` exactly, with no parameters.                                    |
| `duplicate test name "test_basic"`                                  | Same name in two stages or lists                            | Make every test name unique across the problem.                                             |
| `stage 2 solution fails stage 1 test test_x`                        | Solution isn't cumulative, or broke backward compatibility  | Include all earlier code in the solution; add new behavior via optional params/new methods. |
| `stage 3 adds no failing test against the stage 2 solution`         | New tests only re-check old behavior                        | Add a test for the new requirement that the old code can't pass.                            |
| `starter code passes every test`                                    | Starter contains a working solution                         | Starter must only contain signatures with `pass`/`raise NotImplementedError`.               |
| `time limit exceeded`                                               | Large tests too large or solution too slow                  | Shrink inputs to n ≈ 10⁴-10⁵ or optimize the reference solution.                            |
| `…: ModuleNotFoundError: No module named 'pandas'`                  | Package used but not declared                               | Add it to `packages`, or remove the import.                                                 |

### Migration notes

- **Version 1** (current): initial format.
- When the format changes, `schemaVersion` is incremented, this section describes how to
  migrate a version-_N_ file to _N+1_, and the validator rejects unknown versions.
