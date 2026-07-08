from __future__ import annotations

import httpx

from riley_osint.config import settings
from riley_osint.detect import extract_domain
from riley_osint.models import ToolResult
from riley_osint.tools.base import OsintTool

TIMEOUT = settings.request_timeout


class HibpEmailBreaches(OsintTool):
    name = "Have I Been Pwned"
    module = "breach"

    async def run(self, target: str, target_type: str) -> ToolResult:
        if target_type not in ("email", "domain"):
            return ToolResult(
                tool=self.name, module=self.module, status="skipped", error="Email/domain only"
            )
        key = settings.hibp_api_key
        if not key:
            return ToolResult(
                tool=self.name, module=self.module, status="skipped", error="No API key"
            )

        if target_type == "email":
            endpoint = f"https://haveibeenpwned.com/api/v3/breachedaccount/{target}"
        else:
            endpoint = f"https://haveibeenpwned.com/api/v3/breacheddomain/{target}"

        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as client:
                resp = await client.get(
                    endpoint,
                    headers={
                        "hibp-api-key": key,
                        "User-Agent": "RILEY-OSINT",
                    },
                    params={"truncateResponse": "false"} if target_type == "email" else None,
                )
                if resp.status_code == 404:
                    return ToolResult(
                        tool=self.name,
                        module=self.module,
                        status="ok",
                        data={"target": target, "breached": False, "breaches": []},
                    )
                resp.raise_for_status()
                breaches = resp.json()

            if target_type == "domain":
                breach_names = list(breaches.keys()) if isinstance(breaches, dict) else []
                return ToolResult(
                    tool=self.name,
                    module=self.module,
                    status="ok",
                    data={
                        "target": target,
                        "breached": bool(breach_names),
                        "breach_count": len(breach_names),
                        "breaches": breach_names[:20],
                    },
                )

            return ToolResult(
                tool=self.name,
                module=self.module,
                status="ok",
                data={
                    "target": target,
                    "breached": True,
                    "breach_count": len(breaches),
                    "breaches": [
                        {
                            "name": b.get("Name"),
                            "date": b.get("BreachDate"),
                            "pwn_count": b.get("PwnCount"),
                            "data_classes": b.get("DataClasses", []),
                        }
                        for b in breaches[:10]
                    ],
                },
            )
        except Exception as exc:
            return ToolResult(
                tool=self.name, module=self.module, status="error", error=str(exc)
            )
