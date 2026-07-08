from __future__ import annotations

import httpx

from riley_osint.config import settings
from riley_osint.models import ToolResult
from riley_osint.tools.base import OsintTool

TIMEOUT = settings.request_timeout

# Lightweight username presence checks — HEAD requests to public profile URLs
PLATFORMS: dict[str, str] = {
    "GitHub": "https://github.com/{username}",
    "Twitter/X": "https://x.com/{username}",
    "Reddit": "https://www.reddit.com/user/{username}",
    "Instagram": "https://www.instagram.com/{username}/",
    "LinkedIn": "https://www.linkedin.com/in/{username}/",
    "TikTok": "https://www.tiktok.com/@{username}",
    "Medium": "https://medium.com/@{username}",
    "Dev.to": "https://dev.to/{username}",
    "HackerNews": "https://news.ycombinator.com/user?id={username}",
    "Keybase": "https://keybase.io/{username}",
}


class UsernamePresence(OsintTool):
    name = "Username Presence"
    module = "social"

    async def run(self, target: str, target_type: str) -> ToolResult:
        if target_type not in ("username", "email"):
            return ToolResult(
                tool=self.name,
                module=self.module,
                status="skipped",
                error="Username/email only",
            )
        username = target.split("@")[0] if target_type == "email" else target

        async def check_platform(
            client: httpx.AsyncClient, platform: str, url: str
        ) -> dict[str, str | bool]:
            try:
                resp = await client.head(url, follow_redirects=True)
                # 200 = found, 404 = not found, 429/403 = rate limited
                found = resp.status_code == 200
                return {"platform": platform, "url": url, "found": found, "status": resp.status_code}
            except Exception as exc:
                return {"platform": platform, "url": url, "found": False, "error": str(exc)}

        try:
            async with httpx.AsyncClient(
                timeout=TIMEOUT,
                headers={"User-Agent": "RILEY-OSINT/0.1 (security research)"},
            ) as client:
                tasks = [
                    check_platform(client, platform, url.format(username=username))
                    for platform, url in PLATFORMS.items()
                ]
                import asyncio

                results = await asyncio.gather(*tasks)

            found = [r for r in results if r.get("found")]
            return ToolResult(
                tool=self.name,
                module=self.module,
                status="ok",
                data={
                    "username": username,
                    "platforms_checked": len(PLATFORMS),
                    "profiles_found": len(found),
                    "found_on": found,
                    "all_results": results,
                },
            )
        except Exception as exc:
            return ToolResult(
                tool=self.name, module=self.module, status="error", error=str(exc)
            )
