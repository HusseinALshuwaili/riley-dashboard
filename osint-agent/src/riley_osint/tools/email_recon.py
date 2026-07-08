from __future__ import annotations

import httpx

from riley_osint.config import settings
from riley_osint.models import ToolResult
from riley_osint.tools.base import OsintTool

TIMEOUT = settings.request_timeout


class HunterEmailLookup(OsintTool):
    name = "Hunter.io"
    module = "email"

    async def run(self, target: str, target_type: str) -> ToolResult:
        if target_type != "email":
            return ToolResult(
                tool=self.name, module=self.module, status="skipped", error="Email only"
            )
        key = settings.hunter_api_key
        if not key:
            return ToolResult(
                tool=self.name, module=self.module, status="skipped", error="No API key"
            )
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as client:
                resp = await client.get(
                    "https://api.hunter.io/v2/email-verifier",
                    params={"email": target, "api_key": key},
                )
                resp.raise_for_status()
                data = resp.json().get("data", {})
            return ToolResult(
                tool=self.name,
                module=self.module,
                status="ok",
                data={
                    "email": target,
                    "status": data.get("status"),
                    "score": data.get("score"),
                    "disposable": data.get("disposable"),
                    "webmail": data.get("webmail"),
                    "sources_count": len(data.get("sources", [])),
                },
            )
        except Exception as exc:
            return ToolResult(
                tool=self.name, module=self.module, status="error", error=str(exc)
            )


class EmailMxCheck(OsintTool):
    name = "Email MX Check"
    module = "email"

    async def run(self, target: str, target_type: str) -> ToolResult:
        if target_type != "email":
            return ToolResult(
                tool=self.name, module=self.module, status="skipped", error="Email only"
            )
        domain = target.split("@", 1)[1]
        try:
            import dns.resolver

            answers = dns.resolver.resolve(domain, "MX")
            mx_records = sorted(
                [{"priority": r.preference, "host": str(r.exchange)} for r in answers],
                key=lambda x: x["priority"],
            )
            return ToolResult(
                tool=self.name,
                module=self.module,
                status="ok",
                data={"email": target, "domain": domain, "mx_records": mx_records},
            )
        except Exception as exc:
            return ToolResult(
                tool=self.name, module=self.module, status="error", error=str(exc)
            )
