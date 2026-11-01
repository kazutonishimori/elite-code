"""Behavioral tests for the shared harness (run under CPython; parity with Pyodide is tested
separately in test_parity.py)."""

import json
import os
import subprocess
import sys

import elite_harness as h
import pytest
from conftest import HARNESS_DIR, make_test

ADD = "def add(a, b):\n    return a + b\n"


def run(code, tests=(), **extra):
    return h.run({"code": code, "tests": list(tests), "mode": "run", **extra})


class TestResults:
    def test_passing_and_failing_tests(self, t):
        result = run(
            ADD, [t("test_ok", "assert add(1, 2) == 3"), t("test_bad", "assert add(1, 2) == 4")]
        )
        assert result["status"] == "ok"
        assert [x["status"] for x in result["tests"]] == ["passed", "failed"]
        assert result["summary"] == {
            "total": 2,
            "passed": 1,
            "failed": 1,
            "errors": 0,
            "skipped": 0,
        }
        bad = result["tests"][1]
        assert bad["expression"] == "add(1, 2) == 4"
        assert (bad["actual"], bad["expected"], bad["comparison"]) == ("3", "4", "==")
        assert bad["message"] == "assert add(1, 2) == 4"
        assert bad["errorType"] == "AssertionError"
        assert bad["traceback"].endswith("AssertionError: assert add(1, 2) == 4")

    def test_metadata_is_passed_through(self, t):
        test = t("test_ok", "assert add(1, 1) == 2", stage_index=2, visibility="hidden")
        out = run(ADD, [test])["tests"][0]
        assert (out["stageId"], out["stageIndex"], out["visibility"]) == ("stage-3", 2, "hidden")
        assert out["durationMs"] >= 0

    @pytest.mark.parametrize(
        ("assertion", "comparison"),
        [
            ("assert add(1, 1) != 2", "!="),
            ("assert add(1, 1) < 2", "<"),
            ("assert add(1, 1) <= 1", "<="),
            ("assert add(1, 1) > 2", ">"),
            ("assert add(1, 1) >= 3", ">="),
            ("assert add(1, 1) is None", "is"),
            ("assert None is not None", "is not"),
            ("assert 5 in [1, 2]", "in"),
            ("assert 1 not in [1, 2]", "not in"),
        ],
    )
    def test_comparison_operators(self, t, assertion, comparison):
        out = run(ADD, [t("test_cmp", assertion)])["tests"][0]
        assert out["status"] == "failed"
        assert out["comparison"] == comparison

    def test_truthy_assert_and_custom_message(self, t):
        tests = [
            t("test_truthy", "assert add(0, 0)"),
            t("test_message", 'assert add(1, 1) == 3, f"got {add(1, 1)}"'),
            t("test_chained", "assert 1 < add(1, 1) < 2"),
        ]
        truthy, message, chained = run(ADD, tests)["tests"]
        assert (truthy["expression"], truthy["actual"], truthy["expected"]) == (
            "add(0, 0)",
            "0",
            None,
        )
        assert message["message"] == "got 2"
        assert chained["status"] == "failed"
        assert chained["expression"] == "1 < add(1, 1) < 2"

    def test_message_is_only_evaluated_on_failure(self, t):
        out = run(ADD, [t("test_lazy", "assert add(1, 1) == 2, 1 / 0")])["tests"][0]
        assert out["status"] == "passed"

    def test_asserts_in_nested_helpers_are_rewritten(self, t):
        body = "def check(x):\n    assert x == 1\nfor i in [1, 2]:\n    check(i)"
        out = run("", [t("test_nested", body)])["tests"][0]
        assert (out["actual"], out["expected"]) == ("2", "1")

    @pytest.mark.parametrize(
        ("actual", "expected", "difference"),
        [
            ("[1, 2, 3]", "[1, 9, 3]", "first difference at index 1: 2 != 9"),
            ("[1, 2]", "[1, 2, 3]", "length differs: 2 vs 3"),
            ("(1, 2)", "[1, 2]", "type differs: tuple vs list"),
            ("{'a': 1}", "{'a': 1, 'b': 2}", "missing key 'b'"),
            ("{'a': 1, 'c': 3}", "{'a': 1}", "unexpected key 'c'"),
            ("{'a': 1}", "{'a': 2}", "at key 'a': 1 != 2"),
            ("1", "'1'", "type differs: int vs str"),
            ("1", "2", None),
        ],
    )
    def test_difference_explanations(self, t, actual, expected, difference):
        out = run("", [t("test_diff", f"assert {actual} == {expected}")])["tests"][0]
        assert out["difference"] == difference

    def test_difference_helper_edge_cases(self):
        assert h.explain_difference([1], [1]) is None
        assert h.explain_difference({"a": 1}, {"a": 1}) is None

        class Weird:
            def __eq__(self, other):
                raise RuntimeError("no")

        assert h.explain_difference([Weird()], [1]) is None

    def test_plain_assertion_error_from_user_code(self, t):
        code = "def check(x):\n    assert x > 0, 'positive only'\n"
        out = run(code, [t("test_user_assert", "check(-1)")])["tests"][0]
        assert out["status"] == "failed"
        assert out["message"] == "positive only"
        assert out["actual"] is None

    def test_bare_assertion_error_has_default_message(self, t):
        out = run("def f():\n    raise AssertionError\n", [t("test_bare", "f()")])["tests"][0]
        assert out["message"] == "assertion failed"


class TestErrors:
    def test_exception_in_user_code(self, t):
        code = "def divide(a, b):\n    return a / b\n"
        out = run(code, [t("test_div", "assert divide(1, 0) == 0")])["tests"][0]
        assert out["status"] == "error"
        assert out["errorType"] == "ZeroDivisionError"
        assert out["message"] == "division by zero"
        assert out["traceback"] == (
            "Traceback (most recent call last):\n"
            '  File "<test:test_div>", line 2, in test_div\n'
            "    assert divide(1, 0) == 0\n"
            '  File "<solution>", line 2, in divide\n'
            "    return a / b\n"
            "ZeroDivisionError: division by zero"
        )

    def test_syntax_error_skips_tests(self, t):
        result = run("def f(:\n    pass\n", [t("test_a", "assert True")])
        assert result["status"] == "compile_error"
        assert result["error"]["type"] == "SyntaxError"
        assert result["error"]["line"] == 1
        assert result["error"]["traceback"].startswith('  File "<solution>", line 1\n    def f(:\n')
        assert "^" in result["error"]["traceback"]
        assert result["tests"][0]["status"] == "skipped"
        assert result["tests"][0]["message"] == "Not run: your code failed to compile."
        assert result["summary"]["skipped"] == 1

    def test_indentation_error(self):
        result = run("def f():\nreturn 1\n")
        assert result["status"] == "compile_error"
        assert result["error"]["type"] == "IndentationError"

    def test_exception_at_import_time(self, t):
        result = run("print('loading')\nx = undefined_name\n", [t("test_a", "assert True")])
        assert result["status"] == "load_error"
        assert result["error"]["type"] == "NameError"
        assert result["error"]["line"] == 2
        assert result["stdout"] == "loading\n"
        assert result["tests"][0]["message"] == "Not run: your code failed to load."

    def test_sys_exit_is_contained(self, t):
        assert run("import sys\nsys.exit(3)\n")["status"] == "load_error"
        out = run("import sys\ndef f():\n    sys.exit(1)\n", [t("test_exit", "f()")])["tests"][0]
        assert out["errorType"] == "SystemExit"

    def test_input_is_unavailable(self, t):
        out = run("def ask():\n    return input('name? ')\n", [t("test_input", "ask()")])["tests"][
            0
        ]
        assert out["status"] == "error"
        assert "input() is not available" in out["message"]

    def test_broken_test_code(self):
        tests = [
            {"name": "test_syntax", "code": "def test_syntax(:\n    pass\n"},
            {"name": "test_missing", "code": "def something_else():\n    pass\n"},
        ]
        syntax, missing = run("", tests)["tests"]
        assert syntax["status"] == "error"
        assert syntax["message"].startswith("Test code failed to compile")
        assert missing["status"] == "error"
        assert missing["errorType"] == "NameError"

    def test_recursion_error(self, t):
        code = "def forever(n):\n    return forever(n + 1)\n"
        out = run(code, [t("test_recursion", "forever(0)")])["tests"][0]
        assert out["errorType"] == "RecursionError"

    def test_exception_without_message(self, t):
        out = run("def f():\n    raise KeyError\n", [t("test_k", "f()")])["tests"][0]
        assert out["traceback"].endswith("\nKeyError")

    def test_unrepresentable_values(self, t):
        code = "class Bad:\n    def __repr__(self):\n        raise ValueError('nope')\n"
        out = run(code, [t("test_bad_repr", "assert Bad() == 1")])["tests"][0]
        assert out["actual"] == "<unrepresentable Bad: ValueError>"


class TestOutput:
    def test_prints_are_captured_per_test(self, t):
        code = "print('top level')\nimport sys\nprint('warn', file=sys.stderr)\n"
        tests = [
            t("test_one", "print('one')\nassert True"),
            t("test_two", "print('two')\nassert False"),
        ]
        result = run(code, tests)
        assert (result["stdout"], result["stderr"]) == ("top level\n", "warn\n")
        assert [x["stdout"] for x in result["tests"]] == ["one\n", "two\n"]

    def test_unicode(self, t):
        code = "def greet(name):\n    return f'こんにちは, {name} 👋'\nprint('naïve café ✓')\n"
        result = run(code, [t("test_greet", "assert greet('Zoë') == 'hi'")])
        assert result["stdout"] == "naïve café ✓\n"
        assert result["tests"][0]["actual"] == "'こんにちは, Zoë 👋'"
        assert (
            json.loads(h.run_json(json.dumps({"code": code, "tests": []})))["stdout"]
            == "naïve café ✓\n"
        )

    def test_large_output_is_truncated(self, t):
        out = run("", [t("test_spam", "for i in range(100_000):\n    print('line', i)")])["tests"][
            0
        ]
        assert out["status"] == "passed"
        assert len(out["stdout"]) < h.MAX_STREAM_CHARS + 100
        assert out["stdout"].endswith("… output truncated after 20,000 characters")

    def test_large_values_are_summarized(self, t):
        out = run("", [t("test_big", "assert list(range(100_000)) == []")])["tests"][0]
        assert len(out["actual"]) <= h.MAX_REPR_CHARS + 1
        assert "..." in out["actual"]
        assert len(h.safe_repr("x" * 10_000)) <= h.MAX_REPR_CHARS + 1

    def test_long_reprs_are_shortened(self):
        class Long:
            def __repr__(self):
                return "y" * 5000

        assert h.safe_repr(Long()) == "y" * 248 + "..." + "y" * 248
        h._repr.maxother = 10_000
        try:
            assert h.safe_repr(Long()).endswith("…")
        finally:
            h._repr.maxother = 500

    def test_bounded_writer_rejects_bytes(self):
        writer = h.BoundedWriter(5)
        assert writer.writable()
        with pytest.raises(TypeError):
            writer.write(b"x")
        writer.write("abcdefgh")
        writer.write("more")
        assert writer.getvalue().startswith("abcde\n…")


class TestIsolationAndDeterminism:
    def test_module_name_is_solution(self, t):
        code = "ran = []\nif __name__ == '__main__':\n    ran.append(1)\n"
        assert run(code, [t("test_name", "assert ran == []")])["tests"][0]["status"] == "passed"

    def test_random_is_seeded_per_test(self, t):
        tests = [
            t("test_r1", "import random\nprint(random.random())"),
            t("test_r2", "import random\nprint(random.random())"),
        ]
        first, second = run("", tests)["tests"]
        assert first["stdout"] == second["stdout"]

    def test_names_defined_by_a_test_do_not_leak(self):
        tests = [
            {
                "name": "test_defines",
                "code": "HELPER = 1\ndef test_defines():\n    assert HELPER == 1\n",
            },
            {
                "name": "test_uses",
                "code": "def test_uses():\n    assert 'HELPER' not in globals()\n",
            },
        ]
        assert [x["status"] for x in run("", tests)["tests"]] == ["passed", "passed"]

    def test_runs_are_independent(self, t):
        run("counter = 41\n")
        assert (
            run("", [t("test_fresh", "assert 'counter' not in globals()")])["tests"][0]["status"]
            == "passed"
        )


class TestCustomMode:
    def test_trailing_expression_value(self):
        result = run(ADD, mode="custom", customInput="print('hi')\nadd(2, 3)")
        assert result["custom"] == {"stdout": "hi\n", "stderr": "", "value": "5", "error": None}
        assert result["tests"] == []

    def test_statements_only(self):
        assert run(ADD, mode="custom", customInput="x = add(1, 1)")["custom"]["value"] is None

    def test_errors_are_reported(self):
        custom = run(ADD, mode="custom", customInput="add(1)")["custom"]
        assert custom["error"]["type"] == "TypeError"
        assert '<custom>", line 1' in custom["error"]["traceback"]

    def test_syntax_error_in_custom_input(self):
        assert (
            run(ADD, mode="custom", customInput="add(")["custom"]["error"]["type"] == "SyntaxError"
        )


def _cli(payload: dict, timeout: float = 20):
    env = {**os.environ, "PYTHONHASHSEED": "0", "PYTHONIOENCODING": "utf-8"}
    return subprocess.run(
        [sys.executable, str(HARNESS_DIR / "elite_harness.py")],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        encoding="utf-8",
        env=env,
        timeout=timeout,
        check=False,
    )


class TestCommandLine:
    def test_result_follows_the_marker_even_if_user_code_prints(self):
        proc = _cli({"code": "print('noise')\n", "tests": [make_test("test_a", "assert True")]})
        assert proc.returncode == 0
        _, _, tail = proc.stdout.rpartition(f"\n{h.RESULT_MARKER}\n")
        result = json.loads(tail)
        assert result["stdout"] == "noise\n"
        assert result["summary"]["passed"] == 1

    def test_unicode_survives_the_process_boundary(self):
        proc = _cli({"code": "print('日本語 🐍')\n", "tests": []})
        result = json.loads(proc.stdout.rpartition(f"\n{h.RESULT_MARKER}\n")[2])
        assert result["stdout"] == "日本語 🐍\n"

    def test_infinite_loop_must_be_stopped_by_the_caller(self):
        payload = {"code": "", "tests": [make_test("test_loop", "while True:\n    pass")]}
        with pytest.raises(subprocess.TimeoutExpired):
            _cli(payload, timeout=1.5)
