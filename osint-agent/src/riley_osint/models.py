from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Callable, Literal

from pydantic import BaseModel, Field

ToolStatus = Literal["ok", "error", "skipped"]
EventCallback = Callable[["ReconEvent"], None]


class ToolResult(BaseModel):
    tool: str
    module: str
    status: ToolStatus
    data: dict[str, Any] | None = None
    error: str | None = None


class ReconEvent(BaseModel):
    type: Literal[
        "osint_start",
        "osint_result",
        "module_start",
        "agent_step",
        "scan_complete",
        "scan_error",
    ]
    message: str | None = None
    module: str | None = None
    tool: str | None = None
    tool_status: ToolStatus | None = None
    agent: str | None = None


class SynthesizerOutput(BaseModel):
    threat_context: str
    key_findings: list[str] = Field(default_factory=list)
    indicators: list[str] = Field(default_factory=list)
    attack_surface: list[str] = Field(default_factory=list)
    initial_risk_rating: Literal["low", "medium", "high", "critical"]


class InvestigatorOutput(BaseModel):
    mitre_techniques: list[str] = Field(default_factory=list)
    attack_narrative: str
    exposure_profile: str
    confidence_factors: list[str] = Field(default_factory=list)
    contradictions: list[str] = Field(default_factory=list)


class AssessorOutput(BaseModel):
    risk_score: int = Field(ge=0, le=100)
    risk_level: Literal["low", "medium", "high", "critical"]
    threat_summary: str
    iocs: list[str] = Field(default_factory=list)
    recommendations: str
    analyst_rationale: str


class ReconReport(BaseModel):
    target: str
    target_type: str
    started_at: datetime
    completed_at: datetime | None = None
    duration_ms: int | None = None
    modules_run: list[str] = Field(default_factory=list)
    tool_results: list[ToolResult] = Field(default_factory=list)
    synthesis: SynthesizerOutput | None = None
    investigation: InvestigatorOutput | None = None
    assessment: AssessorOutput | None = None
    error: str | None = None

    def finish(self) -> None:
        if self.completed_at is None:
            self.completed_at = datetime.now(timezone.utc)
        if self.started_at and self.completed_at:
            self.duration_ms = int(
                (self.completed_at - self.started_at).total_seconds() * 1000
            )
