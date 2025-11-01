from __future__ import annotations

import os
import sys
from collections.abc import Iterable


def _supports_color() -> bool:
    if os.environ.get("NO_COLOR"):
        return False
    if os.environ.get("FARMPL_COLOR") == "0":
        return False
    return sys.stdout.isatty()


def _c(code: str, text: str) -> str:
    return f"\033[{code}m{text}\033[0m"


def color(text: str, *, kind: str | None = None) -> str:
    if not _supports_color() or not kind:
        return text
    if kind == "title":
        return _c("1;36", text)  # bold cyan
    if kind == "ok":
        return _c("32", text)  # green
    if kind == "warn":
        return _c("33", text)  # yellow
    if kind == "err":
        return _c("31", text)  # red
    return text


def print_table(headers: list[str], rows: Iterable[Iterable[str]]) -> None:
    widths = [len(h) for h in headers]
    grid = [list(map(str, r)) for r in rows]
    for r in grid:
        for i, cell in enumerate(r):
            widths[i] = max(widths[i], len(cell))
    # header
    line = " ".join(h.ljust(widths[i]) for i, h in enumerate(headers))
    print(color(line, kind="title"))
    # rows
    for r in grid:
        print(" ".join(str(r[i]).ljust(widths[i]) for i in range(len(headers))))
