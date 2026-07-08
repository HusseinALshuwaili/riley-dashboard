from __future__ import annotations

import asyncio
import json
from typing import Any

import dns.resolver
import httpx

from riley_osint.config import settings
from riley_osint.models import ToolResult
from riley_osint.tools.base import OsintTool

TIMEOUT = settings.request_timeout


async def _fetch_json(url: str, headers: dict[str, str] | None = None) -> Any:
    async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True) as client:
        resp = await client.get(url, headers=headers or {})
        resp.raise_for_status()
        return resp.json()


class CrtShSubdomains(OsintTool):
    name = "crt.sh"
    module = "dns"

    async def run(self, target: str, target_type: str) -> ToolResult:
        if target_type not in ("domain", "org"):
            return ToolResult(
                tool=self.name, module=self.module, status="skipped", error="Domain only"
            )
        domain = target if target_type == "domain" else target
        try:
            url = f"https://crt.sh/?q=%25.{domain}&output=json"
            async with httpx.AsyncClient(timeout=TIMEOUT) as client:
                resp = await client.get(url)
                if resp.status_code == 404:
                    return ToolResult(
                        tool=self.name,
                        module=self.module,
                        status="ok",
                        data={"domain": domain, "subdomain_count": 0, "subdomains": []},
                    )
                resp.raise_for_status()
                entries = resp.json()
            subdomains: set[str] = set()
            for entry in entries:
                name = entry.get("name_value", "")
                for part in name.split("\n"):
                    part = part.strip().lower().removeprefix("*.")
                    if part.endswith(domain):
                        subdomains.add(part)
            return ToolResult(
                tool=self.name,
                module=self.module,
                status="ok",
                data={
                    "domain": domain,
                    "subdomain_count": len(subdomains),
                    "subdomains": sorted(subdomains)[:100],
                },
            )
        except Exception as exc:
            return ToolResult(
                tool=self.name, module=self.module, status="error", error=str(exc)
            )


class DnsRecords(OsintTool):
    name = "DNS Records"
    module = "dns"

    async def run(self, target: str, target_type: str) -> ToolResult:
        if target_type not in ("domain", "org"):
            return ToolResult(
                tool=self.name, module=self.module, status="skipped", error="Domain only"
            )
        domain = target if target_type == "domain" else target
        record_types = ["A", "AAAA", "MX", "NS", "TXT", "CNAME", "SOA"]

        def _query() -> dict[str, list[str]]:
            resolver = dns.resolver.Resolver()
            resolver.lifetime = TIMEOUT
            records: dict[str, list[str]] = {}
            for rtype in record_types:
                try:
                    answers = resolver.resolve(domain, rtype)
                    records[rtype] = [str(r) for r in answers]
                except (
                    dns.resolver.NoAnswer,
                    dns.resolver.NXDOMAIN,
                    dns.resolver.NoNameservers,
                    dns.exception.Timeout,
                ):
                    continue
            return records

        try:
            records = await asyncio.to_thread(_query)
            return ToolResult(
                tool=self.name,
                module=self.module,
                status="ok",
                data={"domain": domain, "records": records},
            )
        except Exception as exc:
            return ToolResult(
                tool=self.name, module=self.module, status="error", error=str(exc)
            )


class WaybackSnapshot(OsintTool):
    name = "Wayback Machine"
    module = "domain"

    async def run(self, target: str, target_type: str) -> ToolResult:
        if target_type not in ("domain", "url", "org"):
            return ToolResult(
                tool=self.name, module=self.module, status="skipped", error="Domain/URL only"
            )
        from urllib.parse import urlparse

        if target_type == "url":
            host = urlparse(target).netloc
        else:
            host = target
        try:
            url = f"https://archive.org/wayback/available?url={host}"
            data = await _fetch_json(url)
            snapshot = data.get("archived_snapshots", {}).get("closest")
            return ToolResult(
                tool=self.name,
                module=self.module,
                status="ok",
                data={
                    "host": host,
                    "available": snapshot is not None,
                    "closest_snapshot": snapshot,
                },
            )
        except Exception as exc:
            return ToolResult(
                tool=self.name, module=self.module, status="error", error=str(exc)
            )
