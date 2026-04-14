"""
Backend API tests: register pytest plugin modules (fixtures).

Plugin modules live under ``src/plugins/`` (e.g. ``users/``); ``pythonpath`` in ``pyproject.toml`` includes ``src``.
"""

from __future__ import annotations

pytest_plugins = [
    "plugins.users.fxt_admin_user",
]
