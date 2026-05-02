"""
Simple TTL cache for expensive service calls.

Usage:
    _cache = TtlCache(ttl_seconds=2.0)

    def get_data():
        cached = _cache.get()
        if cached is not None:
            return cached
        result = expensive_call()
        _cache.set(result)
        return result
"""

from __future__ import annotations

import threading
import time


class TtlCache:
    __slots__ = ("_lock", "_ttl", "_value", "_expires_at")

    def __init__(self, ttl_seconds: float) -> None:
        self._lock = threading.Lock()
        self._ttl = ttl_seconds
        self._value: object = None
        self._expires_at: float = 0.0

    def get(self) -> object | None:
        with self._lock:
            if time.monotonic() < self._expires_at:
                return self._value
            return None

    def set(self, value: object) -> None:
        with self._lock:
            self._value = value
            self._expires_at = time.monotonic() + self._ttl

    def invalidate(self) -> None:
        with self._lock:
            self._expires_at = 0.0
            self._value = None
