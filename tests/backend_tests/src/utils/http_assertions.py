"""
Shared HTTP assertion helpers for API tests: error text extraction and failure diagnostics.
"""

from __future__ import annotations

import httpx


def error_text_from_response(resp: httpx.Response) -> str:
    """Parse Nest `message` from JSON if present, else return truncated raw text."""
    try:
        body = resp.json()
        if isinstance(body, dict):
            msg = body.get("message")
            if isinstance(msg, list):
                return " ".join(str(x) for x in msg)
            if isinstance(msg, str):
                return msg
    except Exception:
        pass
    return (resp.text or "")[:2000]


def response_assert_detail(response: httpx.Response) -> str:
    """Single debug line: status, parsed message, body cap (for failed `assert` messages)."""
    snippet = (response.text or "")[:2000]
    return (
        f"status={response.status_code!r} "
        f"message={error_text_from_response(response)!r} "
        f"body[:2000]={snippet!r}"
    )
