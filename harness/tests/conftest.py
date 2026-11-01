import sys
from pathlib import Path

import pytest

HARNESS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HARNESS_DIR))


def make_test(name: str, body: str, stage_index: int = 0, visibility: str = "visible") -> dict:
    """Build a harness test entry from a body (indented automatically)."""
    lines = body.strip("\n").splitlines()
    code = f"def {name}():\n" + "\n".join(f"    {line}" for line in lines) + "\n"
    return {
        "name": name,
        "code": code,
        "stageId": f"stage-{stage_index + 1}",
        "stageIndex": stage_index,
        "visibility": visibility,
    }


@pytest.fixture
def t():
    return make_test
