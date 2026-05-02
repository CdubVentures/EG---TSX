from __future__ import annotations

import ctypes
import os
import shutil
import subprocess
from pathlib import Path

from config import AppConfig


class _FileTime(ctypes.Structure):
    _fields_ = [
        ("dwLowDateTime", ctypes.c_ulong),
        ("dwHighDateTime", ctypes.c_ulong),
    ]


_LAST_CPU_TIMES: tuple[int, int, int] | None = None


def _now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


def _bytes_to_mb(value: int) -> float:
    return round(value / (1024 ** 2), 1)


def get_directory_size_bytes(path: Path) -> int:
    if not path.exists():
        return 0

    total = 0
    for entry in path.rglob("*"):
        if entry.is_file():
            total += entry.stat().st_size
    return total


def _status_from_ratio(ratio: float) -> str:
    if ratio < 0.75:
        return "healthy"
    if ratio < 0.9:
        return "warning"
    return "error"


def _filetime_to_int(filetime: _FileTime) -> int:
    return (int(filetime.dwHighDateTime) << 32) | int(filetime.dwLowDateTime)


def _cpu_times_snapshot() -> tuple[int, int, int] | None:
    try:
        idle_time = _FileTime()
        kernel_time = _FileTime()
        user_time = _FileTime()
        if ctypes.windll.kernel32.GetSystemTimes(
            ctypes.byref(idle_time),
            ctypes.byref(kernel_time),
            ctypes.byref(user_time),
        ) == 0:
            return None

        return (
            _filetime_to_int(idle_time),
            _filetime_to_int(kernel_time),
            _filetime_to_int(user_time),
        )
    except Exception:
        return None


def read_cpu_percent() -> float:
    global _LAST_CPU_TIMES

    try:
        snapshot = _cpu_times_snapshot()
        if snapshot is None:
            _LAST_CPU_TIMES = None
            return 0.0

        if _LAST_CPU_TIMES is None:
            _LAST_CPU_TIMES = snapshot
            return 0.0

        previous_idle, previous_kernel, previous_user = _LAST_CPU_TIMES
        idle_time, kernel_time, user_time = snapshot
        _LAST_CPU_TIMES = snapshot

        idle_delta = idle_time - previous_idle
        kernel_delta = kernel_time - previous_kernel
        user_delta = user_time - previous_user
        total_delta = kernel_delta + user_delta

        if total_delta <= 0:
            return 0.0

        busy_delta = max(total_delta - max(idle_delta, 0), 0)
        return round(max(min((busy_delta / total_delta) * 100.0, 100.0), 0.0), 1)
    except Exception:
        _LAST_CPU_TIMES = None
        return 0.0


def read_memory_snapshot_gb() -> tuple[float, float]:
    class _MemoryStatus(ctypes.Structure):
        _fields_ = [
            ("dwLength", ctypes.c_ulong),
            ("dwMemoryLoad", ctypes.c_ulong),
            ("ullTotalPhys", ctypes.c_ulonglong),
            ("ullAvailPhys", ctypes.c_ulonglong),
            ("ullTotalPageFile", ctypes.c_ulonglong),
            ("ullAvailPageFile", ctypes.c_ulonglong),
            ("ullTotalVirtual", ctypes.c_ulonglong),
            ("ullAvailVirtual", ctypes.c_ulonglong),
            ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
        ]

    try:
        status = _MemoryStatus()
        status.dwLength = ctypes.sizeof(_MemoryStatus)
        if ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(status)) == 0:
            return (0.0, 0.0)
        total_gb = round(status.ullTotalPhys / (1024 ** 3), 1)
        used_gb = round((status.ullTotalPhys - status.ullAvailPhys) / (1024 ** 3), 1)
        return (used_gb, total_gb)
    except Exception:
        return (0.0, 0.0)


def read_disk_free_gb(path: Path) -> tuple[float, float]:
    try:
        usage = shutil.disk_usage(path)
        free_gb = round(usage.free / (1024 ** 3), 1)
        total_gb = round(usage.total / (1024 ** 3), 1)
        return (free_gb, total_gb)
    except Exception:
        return (0.0, 0.0)


def read_system_health(config: AppConfig) -> dict:
    cpu_percent = read_cpu_percent()
    memory_used_gb, memory_total_gb = read_memory_snapshot_gb()
    cache_bytes = get_directory_size_bytes(config.astro_cache_dir) + get_directory_size_bytes(config.vite_cache_dir)
    cache_mb = _bytes_to_mb(cache_bytes)
    disk_free_gb, disk_total_gb = read_disk_free_gb(config.project_root)
    disk_used_ratio = 0.0 if disk_total_gb <= 0 else max(min((disk_total_gb - disk_free_gb) / disk_total_gb, 1.0), 0.0)
    memory_ratio = 0.0 if memory_total_gb <= 0 else max(min(memory_used_gb / memory_total_gb, 1.0), 0.0)

    return {
        "collectedAt": _now_iso(),
        "metrics": [
            {
                "key": "cpu",
                "label": "CPU",
                "value": cpu_percent,
                "max": 100.0,
                "unit": "%",
                "status": _status_from_ratio(max(min(cpu_percent / 100.0, 1.0), 0.0)),
                "detail": "System CPU usage",
            },
            {
                "key": "memory",
                "label": "Memory",
                "value": memory_used_gb,
                "max": memory_total_gb,
                "unit": "GB",
                "status": _status_from_ratio(memory_ratio),
                "detail": f"{memory_used_gb} / {memory_total_gb} GB used",
            },
            {
                "key": "build-cache",
                "label": "Build Cache",
                "value": cache_mb,
                "max": 2048.0,
                "unit": "MB",
                "status": _status_from_ratio(min(cache_mb / 2048.0, 1.0)),
                "detail": "Astro + Vite cache footprint",
            },
            {
                "key": "disk-free",
                "label": "Disk Free",
                "value": disk_free_gb,
                "max": disk_total_gb,
                "unit": "GB",
                "status": _status_from_ratio(disk_used_ratio),
                "detail": f"{disk_free_gb} / {disk_total_gb} GB free",
            },
        ],
    }
