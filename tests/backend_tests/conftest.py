"""
Backend API tests: register pytest plugin modules (fixtures).

Plugin modules live under ``src/plugins/``; ``pythonpath`` in ``pyproject.toml`` includes ``src``.
"""

from __future__ import annotations

pytest_plugins = [
    "plugins.fxt_admin_user",
]
