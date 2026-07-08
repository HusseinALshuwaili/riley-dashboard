from riley_osint.tools.breach_recon import HibpEmailBreaches
from riley_osint.tools.dns_recon import CrtShSubdomains, DnsRecords, WaybackSnapshot
from riley_osint.tools.email_recon import EmailMxCheck, HunterEmailLookup
from riley_osint.tools.social_recon import UsernamePresence
from riley_osint.tools.tech_recon import HttpTechFingerprint
from riley_osint.tools.threat_intel import (
    AbuseIPDB,
    AlienVaultOTX,
    GreyNoise,
    IpInfo,
    Shodan,
    VirusTotal,
)
from riley_osint.tools.base import OsintTool

ALL_TOOLS: list[OsintTool] = [
    # DNS / domain
    CrtShSubdomains(),
    DnsRecords(),
    WaybackSnapshot(),
    # Email
    HunterEmailLookup(),
    EmailMxCheck(),
    # Social
    UsernamePresence(),
    # Tech
    HttpTechFingerprint(),
    # Breach
    HibpEmailBreaches(),
    # Threat intel
    VirusTotal(),
    AbuseIPDB(),
    Shodan(),
    AlienVaultOTX(),
    GreyNoise(),
    IpInfo(),
]

TOOLS_BY_MODULE: dict[str, list[OsintTool]] = {}
for tool in ALL_TOOLS:
    TOOLS_BY_MODULE.setdefault(tool.module, []).append(tool)
