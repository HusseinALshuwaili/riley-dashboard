from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    groq_api_key: str | None = os.getenv("GROQ_API_KEY")
    virustotal_api_key: str | None = os.getenv("VIRUSTOTAL_API_KEY")
    abuseipdb_api_key: str | None = os.getenv("ABUSEIPDB_API_KEY")
    shodan_api_key: str | None = os.getenv("SHODAN_API_KEY")
    otx_api_key: str | None = os.getenv("OTX_API_KEY")
    greynoise_api_key: str | None = os.getenv("GREYNOISE_API_KEY")
    ipinfo_token: str | None = os.getenv("IPINFO_TOKEN")
    hibp_api_key: str | None = os.getenv("HIBP_API_KEY")
    hunter_api_key: str | None = os.getenv("HUNTER_API_KEY")
    request_timeout: float = 12.0


settings = Settings()
