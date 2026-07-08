from __future__ import annotations

import base64
from typing import Any

import httpx

from riley_osint.config import settings
from riley_osint.models import ToolResult
from riley_osint.tools.base import OsintTool

TIMEOUT = settings.request_timeout


async def _get(url: str, headers: dict[str, str] | None = None) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.get(url, headers=headers or {})
        if not resp.is_success:
            raise httpx.HTTPStatusError(
                f"HTTP {resp.status_code}", request=resp.request, response=resp
            )
        return resp.json()


class VirusTotal(OsintTool):
    name = "VirusTotal"
    module = "threat"

    async def run(self, target: str, target_type: str) -> ToolResult:
        key = settings.virustotal_api_key
        if not key:
            return ToolResult(
                tool=self.name, module=self.module, status="skipped", error="No API key"
            )
        endpoints = {
            "ip": f"https://www.virustotal.com/api/v3/ip_addresses/{target}",
            "domain": f"https://www.virustotal.com/api/v3/domains/{target}",
            "hash": f"https://www.virustotal.com/api/v3/files/{target}",
        }
        if target_type == "url":
            vid = base64.urlsafe_b64encode(target.encode()).decode().strip("=")
            endpoint = f"https://www.virustotal.com/api/v3/urls/{vid}"
        elif target_type in endpoints:
            endpoint = endpoints[target_type]
        else:
            return ToolResult(
                tool=self.name, module=self.module, status="skipped", error="Unsupported type"
            )
        try:
            data = await _get(endpoint, {"x-apikey": key})
            attrs = data.get("data", {}).get("attributes", {})
            stats = attrs.get("last_analysis_stats", {})
            return ToolResult(
                tool=self.name,
                module=self.module,
                status="ok",
                data={
                    "malicious": stats.get("malicious", 0),
                    "suspicious": stats.get("suspicious", 0),
                    "harmless": stats.get("harmless", 0),
                    "reputation": attrs.get("reputation"),
                    "tags": attrs.get("tags", []),
                    "country": attrs.get("country"),
                    "as_owner": attrs.get("as_owner"),
                },
            )
        except Exception as exc:
            return ToolResult(
                tool=self.name, module=self.module, status="error", error=str(exc)
            )


class AbuseIPDB(OsintTool):
    name = "AbuseIPDB"
    module = "threat"

    async def run(self, target: str, target_type: str) -> ToolResult:
        if target_type != "ip":
            return ToolResult(
                tool=self.name, module=self.module, status="skipped", error="IP only"
            )
        key = settings.abuseipdb_api_key
        if not key:
            return ToolResult(
                tool=self.name, module=self.module, status="skipped", error="No API key"
            )
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as client:
                resp = await client.get(
                    "https://api.abuseipdb.com/api/v2/check",
                    params={"ipAddress": target, "maxAgeInDays": 90, "verbose": ""},
                    headers={"Key": key, "Accept": "application/json"},
                )
                resp.raise_for_status()
                d = resp.json().get("data", {})
            return ToolResult(
                tool=self.name,
                module=self.module,
                status="ok",
                data={
                    "abuse_confidence_score": d.get("abuseConfidenceScore"),
                    "total_reports": d.get("totalReports"),
                    "country_code": d.get("countryCode"),
                    "isp": d.get("isp"),
                    "is_tor": d.get("isTor"),
                    "last_reported_at": d.get("lastReportedAt"),
                },
            )
        except Exception as exc:
            return ToolResult(
                tool=self.name, module=self.module, status="error", error=str(exc)
            )


class Shodan(OsintTool):
    name = "Shodan"
    module = "threat"

    async def run(self, target: str, target_type: str) -> ToolResult:
        if target_type != "ip":
            return ToolResult(
                tool=self.name, module=self.module, status="skipped", error="IP only"
            )
        key = settings.shodan_api_key
        if not key:
            return ToolResult(
                tool=self.name, module=self.module, status="skipped", error="No API key"
            )
        try:
            data = await _get(
                f"https://api.shodan.io/shodan/host/{target}?key={key}"
            )
            services = [
                {
                    "port": s.get("port"),
                    "product": s.get("product"),
                    "version": s.get("version"),
                }
                for s in (data.get("data") or [])[:10]
            ]
            return ToolResult(
                tool=self.name,
                module=self.module,
                status="ok",
                data={
                    "org": data.get("org"),
                    "asn": data.get("asn"),
                    "country": data.get("country_name"),
                    "ports": data.get("ports", []),
                    "vulns": list((data.get("vulns") or {}).keys()),
                    "services": services,
                },
            )
        except Exception as exc:
            return ToolResult(
                tool=self.name, module=self.module, status="error", error=str(exc)
            )


class AlienVaultOTX(OsintTool):
    name = "AlienVault OTX"
    module = "threat"

    async def run(self, target: str, target_type: str) -> ToolResult:
        type_map = {"ip": "IPv4", "domain": "domain", "hash": "file"}
        otx_type = type_map.get(target_type)
        if not otx_type:
            return ToolResult(
                tool=self.name, module=self.module, status="skipped", error="Unsupported type"
            )
        headers: dict[str, str] = {"Content-Type": "application/json"}
        if settings.otx_api_key:
            headers["X-OTX-API-KEY"] = settings.otx_api_key
        try:
            data = await _get(
                f"https://otx.alienvault.com/api/v1/indicators/{otx_type}/{target}/general",
                headers,
            )
            pulse_info = data.get("pulse_info", {})
            pulses = pulse_info.get("pulses") or []
            return ToolResult(
                tool=self.name,
                module=self.module,
                status="ok",
                data={
                    "pulse_count": pulse_info.get("count", 0),
                    "pulse_names": [p.get("name") for p in pulses[:5]],
                    "reputation": data.get("reputation"),
                    "country": data.get("country_name"),
                },
            )
        except Exception as exc:
            return ToolResult(
                tool=self.name, module=self.module, status="error", error=str(exc)
            )


class GreyNoise(OsintTool):
    name = "GreyNoise"
    module = "threat"

    async def run(self, target: str, target_type: str) -> ToolResult:
        if target_type != "ip":
            return ToolResult(
                tool=self.name, module=self.module, status="skipped", error="IP only"
            )
        headers: dict[str, str] = {"Accept": "application/json"}
        if settings.greynoise_api_key:
            headers["key"] = settings.greynoise_api_key
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as client:
                resp = await client.get(
                    f"https://api.greynoise.io/v3/community/{target}", headers=headers
                )
                if resp.status_code == 404:
                    return ToolResult(
                        tool=self.name,
                        module=self.module,
                        status="ok",
                        data={"seen": False, "classification": "unknown"},
                    )
                resp.raise_for_status()
                data = resp.json()
            return ToolResult(
                tool=self.name,
                module=self.module,
                status="ok",
                data={
                    "seen": data.get("seen"),
                    "classification": data.get("classification"),
                    "noise": data.get("noise"),
                    "riot": data.get("riot"),
                    "name": data.get("name"),
                },
            )
        except Exception as exc:
            return ToolResult(
                tool=self.name, module=self.module, status="error", error=str(exc)
            )


class IpInfo(OsintTool):
    name = "ipinfo.io"
    module = "threat"

    async def run(self, target: str, target_type: str) -> ToolResult:
        if target_type not in ("ip", "domain"):
            return ToolResult(
                tool=self.name, module=self.module, status="skipped", error="IP/domain only"
            )
        token = settings.ipinfo_token
        url = (
            f"https://ipinfo.io/{target}/json?token={token}"
            if token
            else f"https://ipinfo.io/{target}/json"
        )
        try:
            data = await _get(url)
            return ToolResult(
                tool=self.name,
                module=self.module,
                status="ok",
                data={
                    "ip": data.get("ip"),
                    "hostname": data.get("hostname"),
                    "city": data.get("city"),
                    "region": data.get("region"),
                    "country": data.get("country"),
                    "org": data.get("org"),
                    "bogon": data.get("bogon", False),
                },
            )
        except Exception as exc:
            return ToolResult(
                tool=self.name, module=self.module, status="error", error=str(exc)
            )
