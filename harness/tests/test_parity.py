"""The harness must produce identical results in CPython and in Pyodide (the browser path).

Each payload runs in-process under CPython and through real Pyodide (scripts/pyodide-harness-cli.ts
under Node). Timings are the only fields allowed to differ.
"""

import json
import shutil
import subprocess
from pathlib import Path

import elite_harness as h
import pytest
from conftest import make_test

ROOT = Path(__file__).resolve().parents[2]
TSX = ROOT / "node_modules" / ".bin" / "tsx"

pytestmark = pytest.mark.skipif(
    not TSX.exists() or shutil.which("node") is None,
    reason="Node dependencies are not installed (run npm ci)",
)

SOLUTION = """
from collections import Counter

def top_words(text, k):
    counts = Counter(text.lower().split())
    return sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))[:k]

def parse(line):
    key, value = line.split("=")
    return {key.strip(): int(value)}
"""

PAYLOADS = {
    "results": {
        "code": SOLUTION,
        "tests": [
            make_test("test_ok", "assert top_words('a b a', 1) == [('a', 2)]"),
            make_test(
                "test_wrong", "assert top_words('b a b a c', 3) == [('a', 2), ('c', 1), ('b', 2)]"
            ),
            make_test(
                "test_dict", "assert parse('x = 1') == {'x': 2}", stage_index=1, visibility="hidden"
            ),
            make_test("test_raises", "parse('nope')"),
            make_test("test_prints", "print('debug', top_words('z', 1))\nassert True"),
            make_test("test_unicode", "assert top_words('Ünïcode ünïcode 🐍', 1) == [('🐍', 1)]"),
            make_test("test_set_order", "assert sorted({'b', 'a', 'c'}) == ['a', 'b', 'c']"),
            make_test("test_random", "import random\nassert random.randint(1, 10**9) == 0"),
            make_test("test_large", "assert list(range(50_000)) == list(range(50_001))"),
            make_test("test_spam", "for i in range(30_000):\n    print(i)"),
        ],
        "mode": "submit",
    },
    "syntax_error": {
        "code": "def f(:\n    return 1\n",
        "tests": [make_test("test_a", "assert f()")],
    },
    "load_error": {"code": "print('start')\nraise ValueError('bad config')\n", "tests": []},
    "custom": {
        "code": SOLUTION,
        "tests": [],
        "mode": "custom",
        "customInput": "print(1)\ntop_words('x y x', 2)",
    },
}


def _strip_timings(value):
    if isinstance(value, dict):
        return {k: _strip_timings(v) for k, v in value.items() if k != "durationMs"}
    if isinstance(value, list):
        return [_strip_timings(v) for v in value]
    return value


@pytest.fixture(scope="module")
def pyodide_results():
    proc = subprocess.run(
        [str(TSX), str(ROOT / "scripts" / "pyodide-harness-cli.ts")],
        input=json.dumps({"payloads": list(PAYLOADS.values())}),
        capture_output=True,
        text=True,
        encoding="utf-8",
        cwd=ROOT,
        timeout=180,
        check=True,
    )
    results = json.loads(proc.stdout.rpartition(f"\n{h.RESULT_MARKER}\n")[2])
    return dict(zip(PAYLOADS, results, strict=True))


@pytest.mark.parametrize("name", list(PAYLOADS))
def test_cpython_and_pyodide_agree(name, pyodide_results):
    cpython = _strip_timings(h.run(PAYLOADS[name]))
    pyodide = _strip_timings(pyodide_results[name])
    assert pyodide == cpython
