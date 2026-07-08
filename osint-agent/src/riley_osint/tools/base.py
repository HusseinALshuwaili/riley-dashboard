from __future__ import annotations

from typing import Callable

from riley_osint.models import ReconEvent, ToolResult

EventCallback = Callable[[ReconEvent], None]


class OsintTool:
    name: str
    module: str

    async def run(self, target: str, target_type: str) -> ToolResult:
        raise NotImplementedError
