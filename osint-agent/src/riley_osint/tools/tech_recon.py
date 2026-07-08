from __future__ import annotations

import re
from urllib.parse import urlparse

import httpx

from riley_osint.config import settings
from riley_osint.models import ToolResult
from riley_osint.tools.base import OsintTool

TIMEOUT = settings.request_timeout

SECURITY_HEADERS = [
    "strict-transport-security",
    "content-security-policy",
    "x-frame-options",
    "x-content-type-options",
    "referrer-policy",
    "permissions-policy",
]

TECH_SIGNATURES: dict[str, re.Pattern[str]] = {
    "WordPress": re.compile(r"wp-content|wordpress", re.I),
    "React": re.compile(r"react|__NEXT_DATA__|_next/static", re.I),
    "Vue": re.compile(r"vue\.js|__vue__", re.I),
    "Angular": re.compile(r"ng-version|angular", re.I),
    "Cloudflare": re.compile(r"cloudflare", re.I),
    "nginx": re.compile(r"nginx", re.I),
    "Apache": re.compile(r"apache", re.I),
    "Shopify": re.compile(r"cdn\.shopify\.com|shopify", re.I),
    "Google Analytics": re.compile(r"google-analytics|gtag|googletagmanager", re.I),
}


class HttpTechFingerprint(OsintTool):
    name = "HTTP Tech Fingerprint"
    module = "tech"

    async def run(self, target: str, target_type: str) -> ToolResult:
        if target_type not in ("domain", "url", "org"):
            return ToolResult(
                tool=self.name, module=self.module, status="skipped", error="Domain/URL only"
            )

        if target_type == "url":
            url = target
        else:
            url = f"https://{target}"

        try:
            async with httpx.AsyncClient(
                timeout=TIMEOUT,
                follow_redirects=True,
                headers={"User-Agent": "RILEY-OSINT/0.1 (security research)"},
            ) as client:
                resp = await client.get(url)

            headers = {k.lower(): v for k, v in resp.headers.items()}
            body_sample = resp.text[:8000]

            detected: list[str] = []
            haystack = f"{headers.get('server', '')} {headers.get('x-powered-by', '')} {body_sample}"
            for name, pattern in TECH_SIGNATURES.items():
                if pattern.search(haystack):
                    detected.append(name)

            security = {
                h: headers.get(h, "missing") for h in SECURITY_HEADERS
            }

            return ToolResult(
                tool=self.name,
                module=self.module,
                status="ok",
                data={
                    "url": str(resp.url),
                    "status_code": resp.status_code,
                    "server": headers.get("server"),
                    "content_type": headers.get("content-type"),
                    "technologies": detected,
                    "security_headers": security,
                    "redirect_chain": [str(r.url) for r in resp.history],
                    "title": _extract_title(body_sample),
                },
            )
        except Exception as exc:
            return ToolResult(
                tool=self.name, module=self.module, status="error", error=str(exc)
            )


def _extract_title(html: str) -> str | None:
    match = re.search(r"<title[^>]*>([^<]+)</title>", html, re.I)
    return match.group(1).strip() if match else None
