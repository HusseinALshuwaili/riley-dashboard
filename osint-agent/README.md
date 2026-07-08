# RILEY OSINT Recon Agent

Python CLI for full-spectrum OSINT reconnaissance. Runs parallel lookups against online intelligence sources, then synthesizes findings through a 3-stage Groq LLM pipeline (mirrors the Riley dashboard recon agent).

## Quick start

```bash
cd osint-agent
python -m venv .venv && source .venv/bin/activate
pip install -e .
cp .env.example .env   # add GROQ_API_KEY at minimum
riley-recon scan example.com
riley-recon scan 8.8.8.8 --no-ai
riley-recon scan user@company.com --json -o report.json
```

## Modules

| Module | Sources |
|--------|---------|
| Domain/DNS | crt.sh, DNS records (A/AAAA/MX/NS/TXT/CNAME), subdomains |
| Email | MX validation, Hunter.io, Have I Been Pwned |
| Social | Username presence checks across major platforms |
| Tech stack | HTTP headers, HTML meta, security headers, CDN/WAF hints |
| Breach | HIBP email/domain breach lookups |
| Threat intel | VirusTotal, AbuseIPDB, Shodan, OTX, GreyNoise, ipinfo.io |

Tools without API keys are skipped automatically.

## Usage

```
riley-recon scan <target>     Run full recon pipeline
riley-recon tools             List available OSINT modules
riley-recon scan <target> --modules dns,tech,threat
```
