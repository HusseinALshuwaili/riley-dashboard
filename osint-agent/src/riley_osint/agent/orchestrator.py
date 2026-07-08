from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from riley_osint.agent.llm import run_assessor, run_investigator, run_synthesizer
from riley_osint.detect import ReconModule, detect_target_type, modules_for_target
from riley_osint.models import EventCallback, ReconEvent, ReconReport, ToolResult
from riley_osint.tools import TOOLS_BY_MODULE
from riley_osint.tools.base import OsintTool


async def _run_tool(tool: OsintTool, target: str, target_type: str) -> ToolResult:
    try:
        return await tool.run(target, target_type)
    except Exception as exc:
        return ToolResult(
            tool=tool.name,
            module=tool.module,
            status="error",
            error=str(exc),
        )


async def run_recon(
    target: str,
    *,
    modules: list[ReconModule] | None = None,
    use_ai: bool = True,
    on_event: EventCallback | None = None,
) -> ReconReport:
    target = target.strip()
    target_type = detect_target_type(target)
    active_modules = modules or modules_for_target(target_type)

    report = ReconReport(
        target=target,
        target_type=target_type,
        started_at=datetime.now(timezone.utc),
        modules_run=[m.value for m in active_modules],
    )

    def emit(event: ReconEvent) -> None:
        if on_event:
            on_event(event)

    tools: list[OsintTool] = []
    for mod in active_modules:
        tools.extend(TOOLS_BY_MODULE.get(mod.value, []))

    emit(
        ReconEvent(
            type="osint_start",
            message=f"Running {len(tools)} tools across {len(active_modules)} modules",
        )
    )

    for mod in active_modules:
        emit(ReconEvent(type="module_start", module=mod.value, message=f"Starting {mod.value}"))

    results = await asyncio.gather(*[_run_tool(t, target, target_type) for t in tools])
    report.tool_results = list(results)

    for result in results:
        emit(
            ReconEvent(
                type="osint_result",
                tool=result.tool,
                module=result.module,
                tool_status=result.status,
            )
        )

    if not use_ai:
        report.finish()
        emit(ReconEvent(type="scan_complete", message="OSINT collection complete (no AI synthesis)"))
        return report

    try:
        emit(
            ReconEvent(
                type="agent_step",
                agent="synthesizer",
                message="Analyzing OSINT signals…",
            )
        )
        synth = await run_synthesizer(target, target_type, results)
        report.synthesis = synth
        emit(
            ReconEvent(
                type="agent_step",
                agent="synthesizer",
                message=f"Risk: {synth.initial_risk_rating} | {len(synth.key_findings)} findings",
            )
        )

        emit(
            ReconEvent(
                type="agent_step",
                agent="investigator",
                message="Mapping MITRE ATT&CK and exposure profile…",
            )
        )
        inv = await run_investigator(target, target_type, synth)
        report.investigation = inv
        emit(
            ReconEvent(
                type="agent_step",
                agent="investigator",
                message=f"MITRE: {', '.join(inv.mitre_techniques[:3])}",
            )
        )

        emit(
            ReconEvent(
                type="agent_step",
                agent="assessor",
                message="Calculating final risk score…",
            )
        )
        assess = await run_assessor(target, target_type, synth, inv)
        report.assessment = assess
        report.finish()
        emit(
            ReconEvent(
                type="scan_complete",
                message=f"Risk {assess.risk_level} ({assess.risk_score}/100)",
            )
        )
    except Exception as exc:
        report.error = str(exc)
        report.finish()
        emit(ReconEvent(type="scan_error", message=str(exc)))

    return report
