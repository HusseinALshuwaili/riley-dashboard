from __future__ import annotations

import re
from enum import Enum
from typing import Literal

TargetType = Literal[
    "domain",
    "ip",
    "email",
    "username",
    "url",
    "hash",
    "org",
]


class ReconModule(str, Enum):
    DNS = "dns"
    DOMAIN = "domain"
    EMAIL = "email"
    SOCIAL = "social"
    TECH = "tech"
    BREACH = "breach"
    THREAT = "threat"

    @classmethod
    def all(cls) -> list[ReconModule]:
        return list(cls)


IPV4_RE = re.compile(r"^(\d{1,3}\.){3}\d{1,3}$")
IPV6_RE = re.compile(r"^[0-9a-fA-F:]+$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
URL_RE = re.compile(r"^https?://", re.I)
HASH_MD5_RE = re.compile(r"^[0-9a-fA-F]{32}$")
HASH_SHA1_RE = re.compile(r"^[0-9a-fA-F]{40}$")
HASH_SHA256_RE = re.compile(r"^[0-9a-fA-F]{64}$")
USERNAME_RE = re.compile(r"^[a-zA-Z0-9._-]{3,32}$")
DOMAIN_RE = re.compile(
    r"^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$"
)


def detect_target_type(target: str) -> TargetType:
    trimmed = target.strip()

    if IPV4_RE.match(trimmed) or (":" in trimmed and IPV6_RE.match(trimmed)):
        return "ip"
    if HASH_MD5_RE.match(trimmed) or HASH_SHA1_RE.match(trimmed) or HASH_SHA256_RE.match(trimmed):
        return "hash"
    if URL_RE.match(trimmed):
        return "url"
    if EMAIL_RE.match(trimmed):
        return "email"
    if DOMAIN_RE.match(trimmed):
        return "domain"
    if USERNAME_RE.match(trimmed):
        return "username"
    return "org"


def modules_for_target(target_type: TargetType) -> list[ReconModule]:
    mapping: dict[TargetType, list[ReconModule]] = {
        "domain": [
            ReconModule.DNS,
            ReconModule.DOMAIN,
            ReconModule.TECH,
            ReconModule.BREACH,
            ReconModule.THREAT,
        ],
        "ip": [ReconModule.THREAT],
        "email": [ReconModule.EMAIL, ReconModule.BREACH, ReconModule.SOCIAL],
        "username": [ReconModule.SOCIAL],
        "url": [ReconModule.TECH, ReconModule.THREAT],
        "hash": [ReconModule.THREAT],
        "org": [ReconModule.DOMAIN, ReconModule.SOCIAL],
    }
    return mapping.get(target_type, ReconModule.all())


def extract_domain(target: str, target_type: TargetType) -> str | None:
    if target_type == "domain":
        return target.strip().lower()
    if target_type == "email":
        return target.split("@", 1)[1].lower()
    if target_type == "url":
        from urllib.parse import urlparse

        parsed = urlparse(target.strip())
        return parsed.hostname
    return None
