from __future__ import annotations

import json

import httpx

from riley_osint.config import settings
from riley_osint.models import AssessorOutput, InvestigatorOutput, SynthesizerOutput, ToolResult

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"


async def call_groq(system: str, user: str) -> str:
    key = settings.groq_api_key
    if not key:
        raise RuntimeError("GROQ_API_KEY not configured")

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={
                "model": GROQ_MODEL,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                "temperature": 0.3,
                "max_tokens": 1024,
                "response_format": {"type": "json_object"},
            },
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]


def _compact_osint(results: list[ToolResult]) -> str:
    payload = [
        {
            "tool": r.tool,
            "module": r.module,
            "status": r.status,
            "data": r.data,
            "error": r.error,
        }
        for r in results
    ]
    return json.dumps(payload, default=str)[:8000]


async def run_synthesizer(
    target: str, target_type: str, results: list[ToolResult]
) -> SynthesizerOutput:
    system = (
        "You are an OSINT threat synthesizer for security reconnaissance. "
        "Analyze raw OSINT data and extract key signals, attack surface, and indicators. "
        'Return JSON: {"threat_context": str, "key_findings": [str], "indicators": [str], '
        '"attack_surface": [str], "initial_risk_rating": "low"|"medium"|"high"|"critical"}'
    )
    user = f"Target: {target} ({target_type})\n\nOSINT Results:\n{_compact_osint(results)}"
    raw = await call_groq(system, user)
    return SynthesizerOutput.model_validate_json(raw)


async def run_investigator(
    target: str, target_type: str, synth: SynthesizerOutput
) -> InvestigatorOutput:
    system = (
        "You are a SOC threat investigator specializing in MITRE ATT&CK mapping and exposure analysis. "
        'Return JSON: {"mitre_techniques": [str], "attack_narrative": str, "exposure_profile": str, '
        '"confidence_factors": [str], "contradictions": [str]}. '
        'MITRE IDs format: "T1234 - Technique Name"'
    )
    user = (
        f"Target: {target} ({target_type})\n"
        f"Context: {synth.threat_context}\n"
        f"Findings: {'; '.join(synth.key_findings)}\n"
        f"Indicators: {', '.join(synth.indicators)}\n"
        f"Attack surface: {', '.join(synth.attack_surface)}\n"
        f"Risk: {synth.initial_risk_rating}"
    )
    raw = await call_groq(system, user)
    return InvestigatorOutput.model_validate_json(raw)


async def run_assessor(
    target: str,
    target_type: str,
    synth: SynthesizerOutput,
    inv: InvestigatorOutput,
) -> AssessorOutput:
    system = (
        "You are a senior security analyst delivering final OSINT risk assessments. "
        'Return JSON: {"risk_score": 0-100, "risk_level": "low"|"medium"|"high"|"critical", '
        '"threat_summary": str, "iocs": [str], "recommendations": str (markdown checklist), '
        '"analyst_rationale": str}'
    )
    user = (
        f"Target: {target} ({target_type})\n"
        f"Synthesizer: {synth.threat_context} | {synth.initial_risk_rating}\n"
        f"Investigator: {inv.attack_narrative}\n"
        f"MITRE: {', '.join(inv.mitre_techniques)}"
    )
    raw = await call_groq(system, user)
    return AssessorOutput.model_validate_json(raw)
