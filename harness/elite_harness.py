"""Elite Code test harness.

Executes a solver's code, then a list of test functions, and returns structured results.
The same file runs inside Pyodide (browser worker) and CPython (`problem:validate`, pytest),
so it uses only the standard library and formats everything (tracebacks included) itself,
which keeps the output identical across both runtimes.

Payload (dict / JSON):
    code:        the solver's Python source
    tests:       [{name, code, stageId, stageIndex, visibility}]   (run in order)
    mode:        "run" | "submit" | "custom"   (informational, except "custom")
    customInput: Python source run after the solver's code in "custom" mode

Entry points: `run(payload) -> dict`, `run_json(text) -> str`, and `python elite_harness.py`
(reads the payload from stdin, prints `RESULT_MARKER` followed by the result JSON).
"""

from __future__ import annotations

import ast
import builtins
import io
import json
import linecache
import operator
import random
import reprlib
import sys
import time
import traceback
from collections.abc import Callable, Mapping, Sequence
from typing import Any

HARNESS_VERSION = 1
RESULT_MARKER = "@@ELITE_CODE_RESULT@@"
MAX_STREAM_CHARS = 20_000
MAX_REPR_CHARS = 2_000
SOLUTION_FILE = "<solution>"
CUSTOM_FILE = "<custom>"
TEST_FILE_PREFIX = "<test:"
RANDOM_SEED = 0

_COMPARE_OPS: dict[str, tuple[str, Callable[[Any, Any], Any]]] = {
    "Eq": ("==", operator.eq),
    "NotEq": ("!=", operator.ne),
    "Lt": ("<", operator.lt),
    "LtE": ("<=", operator.le),
    "Gt": (">", operator.gt),
    "GtE": (">=", operator.ge),
    "Is": ("is", operator.is_),
    "IsNot": ("is not", operator.is_not),
    "In": ("in", lambda a, b: a in b),
    "NotIn": ("not in", lambda a, b: a not in b),
}


class _Repr(reprlib.Repr):
    def repr_instance(self, x: Any, level: int) -> str:
        # reprlib's default fallback includes a memory address, which is not deterministic.
        try:
            text = builtins.repr(x)
        except Exception as exc:
            return f"<unrepresentable {type(x).__name__}: {type(exc).__name__}>"
        if len(text) > self.maxother:
            half = max(0, (self.maxother - 3) // 2)
            text = text[:half] + "..." + text[len(text) - half :]
        return text


_repr = _Repr()
_repr.maxlevel = 6
_repr.maxlist = _repr.maxtuple = _repr.maxdeque = 100
_repr.maxdict = _repr.maxset = _repr.maxfrozenset = 50
_repr.maxstring = 500
_repr.maxlong = 200
_repr.maxother = 500


def safe_repr(value: Any) -> str:
    text = _repr.repr(value)
    if len(text) > MAX_REPR_CHARS:
        text = text[:MAX_REPR_CHARS] + "…"
    return text


class BoundedWriter(io.TextIOBase):
    """A text stream that keeps at most `limit` characters and remembers it dropped some."""

    def __init__(self, limit: int = MAX_STREAM_CHARS) -> None:
        self._parts: list[str] = []
        self._size = 0
        self._limit = limit
        self.truncated = False

    def writable(self) -> bool:
        return True

    def write(self, s: str) -> int:
        if not isinstance(s, str):
            raise TypeError(f"write() argument must be str, not {type(s).__name__}")
        remaining = self._limit - self._size
        if remaining > 0:
            chunk = s[:remaining]
            self._parts.append(chunk)
            self._size += len(chunk)
        if len(s) > max(remaining, 0):
            self.truncated = True
        return len(s)

    def getvalue(self) -> str:
        text = "".join(self._parts)
        if self.truncated:
            text += f"\n… output truncated after {self._limit:,} characters"
        return text


class _Capture:
    """Redirects sys.stdout / sys.stderr into bounded buffers for the duration of a block."""

    def __enter__(self) -> _Capture:
        self.stdout = BoundedWriter()
        self.stderr = BoundedWriter()
        self._saved = (sys.stdout, sys.stderr)
        sys.stdout, sys.stderr = self.stdout, self.stderr
        return self

    def __exit__(self, *exc: object) -> None:
        sys.stdout, sys.stderr = self._saved


class EliteAssertionError(AssertionError):
    """Raised by rewritten asserts; carries the evaluated operands for the results panel."""

    def __init__(
        self,
        message: str,
        expression: str,
        actual: str | None,
        expected: str | None,
        comparison: str | None,
        difference: str | None,
    ) -> None:
        super().__init__(message)
        self.expression = expression
        self.actual = actual
        self.expected = expected
        self.comparison = comparison
        self.difference = difference


def explain_difference(actual: Any, expected: Any) -> str | None:
    """A short hint about where two unequal values first differ (sequences and mappings)."""
    try:
        if isinstance(actual, Mapping) and isinstance(expected, Mapping):
            missing = [k for k in expected if k not in actual]
            extra = [k for k in actual if k not in expected]
            if missing:
                return f"missing key {safe_repr(missing[0])}"
            if extra:
                return f"unexpected key {safe_repr(extra[0])}"
            for key in expected:
                if actual[key] != expected[key]:
                    return (
                        f"at key {safe_repr(key)}: {safe_repr(actual[key])} != "
                        f"{safe_repr(expected[key])}"
                    )
            return None
        sequence_types = (list, tuple, str)
        if isinstance(actual, sequence_types) and isinstance(expected, sequence_types):
            if type(actual) is not type(expected):
                return f"type differs: {type(actual).__name__} vs {type(expected).__name__}"
            for index, (a, e) in enumerate(zip(actual, expected, strict=False)):
                if a != e:
                    return f"first difference at index {index}: {safe_repr(a)} != {safe_repr(e)}"
            if len(actual) != len(expected):
                return f"length differs: {len(actual)} vs {len(expected)}"
            return None
        if type(actual) is not type(expected):
            return f"type differs: {type(actual).__name__} vs {type(expected).__name__}"
    except Exception:
        return None
    return None


def _compare(
    left: Any,
    right: Any,
    op_name: str,
    expression: str,
    message: Callable[[], Any] | None,
) -> None:
    symbol, fn = _COMPARE_OPS[op_name]
    if fn(left, right):
        return
    text = str(message()) if message is not None else f"assert {expression}"
    difference = explain_difference(left, right) if op_name == "Eq" else None
    raise EliteAssertionError(
        text, expression, safe_repr(left), safe_repr(right), symbol, difference
    )


def _truthy(value: Any, expression: str, message: Callable[[], Any] | None) -> None:
    if value:
        return
    text = str(message()) if message is not None else f"assert {expression}"
    raise EliteAssertionError(text, expression, safe_repr(value), None, None, None)


class _AssertRewriter(ast.NodeTransformer):
    """Turns `assert a == b, msg` into `__elite_compare__(a, b, "Eq", "a == b", lambda: msg)`."""

    def __init__(self, source: str) -> None:
        self._source = source

    def _segment(self, node: ast.AST) -> str:
        return ast.get_source_segment(self._source, node) or ast.unparse(node)

    def visit_Assert(self, node: ast.Assert) -> ast.stmt:
        self.generic_visit(node)
        message: ast.expr = ast.Constant(None)
        if node.msg is not None:
            message = ast.Lambda(
                args=ast.arguments(
                    posonlyargs=[], args=[], kwonlyargs=[], kw_defaults=[], defaults=[]
                ),
                body=node.msg,
            )
        expression = ast.Constant(self._segment(node.test))
        test = node.test
        if isinstance(test, ast.Compare) and len(test.ops) == 1:
            call = ast.Call(
                func=ast.Name("__elite_compare__", ast.Load()),
                args=[
                    test.left,
                    test.comparators[0],
                    ast.Constant(type(test.ops[0]).__name__),
                    expression,
                    message,
                ],
                keywords=[],
            )
        else:
            call = ast.Call(
                func=ast.Name("__elite_truthy__", ast.Load()),
                args=[test, expression, message],
                keywords=[],
            )
        return ast.copy_location(ast.Expr(call), node)


def _register_source(filename: str, source: str) -> None:
    linecache.cache[filename] = (len(source), None, source.splitlines(True), filename)


def _is_user_frame(filename: str) -> bool:
    return filename in (SOLUTION_FILE, CUSTOM_FILE) or filename.startswith(TEST_FILE_PREFIX)


def format_exception(exc: BaseException) -> dict[str, Any]:
    """Structured, runtime-independent description of an exception from user or test code."""
    frames = [
        {"file": f.filename, "line": f.lineno, "function": f.name, "source": (f.line or "").strip()}
        for f in traceback.extract_tb(exc.__traceback__)
        if _is_user_frame(f.filename)
    ]
    message = str(exc)
    if isinstance(exc, SyntaxError):
        message = exc.msg
        frames = [
            {
                "file": exc.filename or SOLUTION_FILE,
                "line": exc.lineno or 0,
                "function": None,
                "source": (exc.text or "").rstrip("\n"),
                "offset": exc.offset,
            }
        ]
    lines = ["Traceback (most recent call last):"] if not isinstance(exc, SyntaxError) else []
    for frame in frames:
        where = f'  File "{frame["file"]}", line {frame["line"]}'
        if frame["function"]:
            where += f", in {frame['function']}"
        lines.append(where)
        source = frame["source"]
        if source:
            if isinstance(exc, SyntaxError):
                stripped = source.lstrip()
                lines.append(f"    {stripped}")
                offset = frame.get("offset")
                if offset:
                    caret = max(offset - (len(source) - len(stripped)), 1)
                    lines.append("    " + " " * (caret - 1) + "^")
            else:
                lines.append(f"    {source}")
    name = "AssertionError" if isinstance(exc, EliteAssertionError) else type(exc).__name__
    lines.append(f"{name}: {message}" if message else name)
    user_lines = [f["line"] for f in frames if f["file"] == SOLUTION_FILE]
    return {
        "type": name,
        "message": message,
        "line": user_lines[-1] if user_lines else None,
        "traceback": "\n".join(lines),
    }


def _no_input(*_args: object) -> str:
    raise RuntimeError(
        "input() is not available: there is no keyboard input. "
        "Tests call your functions directly with arguments."
    )


def _new_namespace() -> dict[str, Any]:
    return {
        "__name__": "solution",
        "__builtins__": builtins,
        "input": _no_input,
        "__elite_compare__": _compare,
        "__elite_truthy__": _truthy,
    }


def _ms(start: float) -> float:
    return round((time.perf_counter() - start) * 1000, 3)


def _test_result(test: Mapping[str, Any], status: str, **fields: Any) -> dict[str, Any]:
    result: dict[str, Any] = {
        "name": test.get("name", ""),
        "stageId": test.get("stageId"),
        "stageIndex": test.get("stageIndex", 0),
        "visibility": test.get("visibility", "visible"),
        "status": status,
        "durationMs": 0.0,
        "stdout": "",
        "stderr": "",
        "message": None,
        "errorType": None,
        "expression": None,
        "expected": None,
        "actual": None,
        "comparison": None,
        "difference": None,
        "traceback": None,
    }
    result.update(fields)
    return result


def _run_test(namespace: dict[str, Any], test: Mapping[str, Any]) -> dict[str, Any]:
    name = str(test.get("name", ""))
    source = str(test.get("code", ""))
    filename = f"{TEST_FILE_PREFIX}{name}>"
    try:
        tree = ast.parse(source, filename=filename)
        tree = ast.fix_missing_locations(_AssertRewriter(source).visit(tree))
        compiled = compile(tree, filename, "exec")
    except SyntaxError as exc:
        info = format_exception(exc)
        return _test_result(
            test,
            "error",
            message=f"Test code failed to compile: {info['message']}",
            errorType="SyntaxError",
            traceback=info["traceback"],
        )
    _register_source(filename, source)

    test_namespace = dict(namespace)
    start = time.perf_counter()
    with _Capture() as cap:
        try:
            exec(compiled, test_namespace)
            fn = test_namespace.get(name)
            if not callable(fn):
                raise NameError(f"test code does not define a function named {name!r}")
            random.seed(RANDOM_SEED)
            fn()
            outcome: dict[str, Any] = {"status": "passed"}
        except EliteAssertionError as exc:
            outcome = {
                "status": "failed",
                "message": str(exc),
                "errorType": "AssertionError",
                "expression": exc.expression,
                "expected": exc.expected,
                "actual": exc.actual,
                "comparison": exc.comparison,
                "difference": exc.difference,
                "traceback": format_exception(exc)["traceback"],
            }
        except AssertionError as exc:
            info = format_exception(exc)
            outcome = {
                "status": "failed",
                "message": info["message"] or "assertion failed",
                "errorType": "AssertionError",
                "traceback": info["traceback"],
            }
        except (Exception, SystemExit) as exc:
            info = format_exception(exc)
            outcome = {
                "status": "error",
                "message": info["message"],
                "errorType": info["type"],
                "traceback": info["traceback"],
            }
    status = outcome.pop("status")
    return _test_result(
        test,
        status,
        durationMs=_ms(start),
        stdout=cap.stdout.getvalue(),
        stderr=cap.stderr.getvalue(),
        **outcome,
    )


def _run_custom(namespace: dict[str, Any], source: str) -> dict[str, Any]:
    """Runs a snippet REPL-style: a trailing expression's value is reported."""
    result: dict[str, Any] = {"stdout": "", "stderr": "", "value": None, "error": None}
    with _Capture() as cap:
        try:
            tree = ast.parse(source, filename=CUSTOM_FILE)
            _register_source(CUSTOM_FILE, source)
            trailing = None
            if tree.body and isinstance(tree.body[-1], ast.Expr):
                trailing = ast.Expression(tree.body.pop().value)
            exec(compile(tree, CUSTOM_FILE, "exec"), namespace)
            if trailing is not None:
                value = eval(compile(trailing, CUSTOM_FILE, "eval"), namespace)
                result["value"] = safe_repr(value)
        except (Exception, SystemExit) as exc:
            result["error"] = format_exception(exc)
    result["stdout"] = cap.stdout.getvalue()
    result["stderr"] = cap.stderr.getvalue()
    return result


def _summary(tests: Sequence[Mapping[str, Any]]) -> dict[str, int]:
    counts = {"total": len(tests), "passed": 0, "failed": 0, "errors": 0, "skipped": 0}
    key = {"passed": "passed", "failed": "failed", "error": "errors", "skipped": "skipped"}
    for t in tests:
        counts[key[t["status"]]] += 1
    return counts


def run(payload: Mapping[str, Any]) -> dict[str, Any]:
    started = time.perf_counter()
    code = str(payload.get("code", ""))
    tests: Sequence[Mapping[str, Any]] = payload.get("tests") or []
    result: dict[str, Any] = {
        "harnessVersion": HARNESS_VERSION,
        "status": "ok",
        "error": None,
        "stdout": "",
        "stderr": "",
        "tests": [],
        "custom": None,
        "summary": None,
        "durationMs": 0.0,
    }

    namespace = _new_namespace()
    try:
        compiled = compile(code, SOLUTION_FILE, "exec")
    except SyntaxError as exc:  # IndentationError and TabError are subclasses
        result["status"] = "compile_error"
        result["error"] = format_exception(exc)
    else:
        _register_source(SOLUTION_FILE, code)
        with _Capture() as cap:
            try:
                exec(compiled, namespace)
            except (Exception, SystemExit) as exc:
                result["status"] = "load_error"
                result["error"] = format_exception(exc)
        result["stdout"] = cap.stdout.getvalue()
        result["stderr"] = cap.stderr.getvalue()

    if result["status"] != "ok":
        reason = "compile" if result["status"] == "compile_error" else "load"
        result["tests"] = [
            _test_result(t, "skipped", message=f"Not run: your code failed to {reason}.")
            for t in tests
        ]
    elif payload.get("mode") == "custom":
        result["custom"] = _run_custom(namespace, str(payload.get("customInput", "")))
    else:
        result["tests"] = [_run_test(namespace, t) for t in tests]

    result["summary"] = _summary(result["tests"])
    result["durationMs"] = _ms(started)
    return result


def run_json(payload_json: str) -> str:
    return json.dumps(run(json.loads(payload_json)), ensure_ascii=False)


def main() -> None:
    out = sys.stdout
    payload_json = sys.stdin.read()
    output = run_json(payload_json)
    out.write(f"\n{RESULT_MARKER}\n{output}\n")
    out.flush()


if __name__ == "__main__":
    main()
