"""
Load repo `.env` into the process so `os.environ` matches local dev / CI (like root `.env` for Playwright).

Loads repository root `.env`, then optional `tests/backend_tests/.env` (overrides root for test-local values).
"""

from __future__ import annotations

from pathlib import Path

_loaded = False


def find_repo_root() -> Path:
    """Workspace root: directory with `package.json` and `backend/`."""
    here = Path(__file__).resolve()
    for p in here.parents:
        if (p / "package.json").is_file() and (p / "backend").is_dir():
            return p
    raise RuntimeError(
        "Could not find repository root (expected package.json and backend/). "
        "Run from the CryptoSandboxQA clone or set variables in the environment."
    )


def ensure_repo_env_loaded() -> None:
    """Idempotent: load dotenv files so `os.environ` is populated for API tests."""
    global _loaded
    if _loaded:
        return
    _loaded = True

    from dotenv import load_dotenv

    root = find_repo_root()
    load_dotenv(root / ".env")
    nested = root / "tests" / "backend_tests" / ".env"
    if nested.is_file():
        load_dotenv(nested, override=True)
