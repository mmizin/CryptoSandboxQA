"""
Shared HTTP client base for backend tests (httpx sync client lifecycle and helpers).
"""

from __future__ import annotations

import os
from typing import Any

import httpx

from utils.env_loader import ensure_repo_env_loaded


def get_api_url() -> str:
    """Same resolution order as Playwright BaseApi.getApiUrl."""
    ensure_repo_env_loaded()
    url = os.environ.get("API_URL", "").strip() or os.environ.get("NEXT_PUBLIC_API_URL", "").strip()
    if not url:
        raise RuntimeError("API_URL or NEXT_PUBLIC_API_URL is not set")
    return url.rstrip("/")


def raise_for_status_with_body(response: httpx.Response) -> None:
    """
    Like ``response.raise_for_status()`` but include a truncated response body in the error
    message for 4xx/5xx (helps debug validation and server errors).
    """
    try:
        response.raise_for_status()
    except httpx.HTTPStatusError as e:
        snippet = ""
        try:
            snippet = (e.response.text or "")[:4000]
        except Exception:
            snippet = "<unreadable body>"
        msg = f"{e.request.method} {e.request.url} -> {e.response.status_code}\n{snippet}"
        raise httpx.HTTPStatusError(msg, request=e.request, response=e.response) from e


class BaseClient:
    """
    Sync httpx wrapper with shared URL resolution and client lifecycle.

    HTTP helpers pass ``expected_failure=False`` by default (raise on 4xx/5xx, return parsed JSON).
    """

    def __init__(
        self,
        base_url: str | None = None,
        *,
        client: httpx.Client | None = None,
        timeout: float = 30.0,
    ) -> None:
        self._base_url = (base_url or get_api_url()).rstrip("/")
        self._owns_client = client is None
        self._client = client or httpx.Client(base_url=self._base_url, timeout=timeout)

    def close(self) -> None:
        if self._owns_client:
            self._client.close()

    def __enter__(self) -> BaseClient:
        return self

    def __exit__(self, *args: object) -> None:
        self.close()

    def _request(
        self,
        method: str,
        url: str,
        *,
        expected_failure: bool = False,
        **kwargs: Any,
    ) -> dict[str, Any] | httpx.Response:
        """
        Single entry for HTTP calls. ``expected_failure`` defaults to ``False``: raise on 4xx/5xx
        (with body snippet) and return parsed JSON. Set ``expected_failure=True`` to skip status
        checks and return the raw ``httpx.Response`` (e.g. negative assertions).
        """
        response = self._client.request(method, url, **kwargs)
        if expected_failure:
            return response
        raise_for_status_with_body(response)
        return response.json()

    def get(
        self,
        url: str,
        *,
        expected_failure: bool = False,
        **kwargs: Any,
    ) -> dict[str, Any] | httpx.Response:
        return self._request("GET", url, expected_failure=expected_failure, **kwargs)

    def post(
        self,
        url: str,
        *,
        expected_failure: bool = False,
        **kwargs: Any,
    ) -> dict[str, Any] | httpx.Response:
        return self._request("POST", url, expected_failure=expected_failure, **kwargs)

    def put(
        self,
        url: str,
        *,
        expected_failure: bool = False,
        **kwargs: Any,
    ) -> dict[str, Any] | httpx.Response:
        return self._request("PUT", url, expected_failure=expected_failure, **kwargs)

    def patch(
        self,
        url: str,
        *,
        expected_failure: bool = False,
        **kwargs: Any,
    ) -> dict[str, Any] | httpx.Response:
        return self._request("PATCH", url, expected_failure=expected_failure, **kwargs)

    def delete(
        self,
        url: str,
        *,
        expected_failure: bool = False,
        **kwargs: Any,
    ) -> dict[str, Any] | httpx.Response:
        return self._request("DELETE", url, expected_failure=expected_failure, **kwargs)
