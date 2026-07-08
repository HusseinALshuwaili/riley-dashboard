from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Annotated, Optional

import typer
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from riley_osint.agent.orchestrator import run_recon
from riley_osint.detect import ReconModule, detect_target_type
from riley_osint.models import ReconEvent, ReconReport

app = typer.Typer(
    name="riley-recon",
    help="RILEY OSINT recon agent — parallel online intelligence with AI synthesis",
    no_args_is_help=True,
)
console = Console()


def _parse_modules(modules: str | None) -> list[ReconModule] | None:
    if not modules:
        return None
    return [ReconModule(m.strip()) for m in modules.split(",")]


def _status_style(status: str) -> str:
    return {"ok": "green", "error": "red", "skipped": "yellow"}.get(status, "white")


def _render_event(event: ReconEvent) -> None:
    if event.type == "module_start":
        console.print(f"\n[bold cyan]▸ {event.module}[/bold cyan]")
    elif event.type == "osint_result":
        style = _status_style(event.tool_status or "")
        icon = {"ok": "✓", "error": "✗", "skipped": "○"}.get(event.tool_status or "", "·")
        console.print(f"  [{style}]{icon} {event.tool}[/{style}]")
    elif event.type == "agent_step":
        console.print(f"  [magenta]🤖 {event.agent}:[/magenta] {event.message}")
    elif event.type == "osint_start":
        console.print(f"[dim]{event.message}[/dim]")
    elif event.type == "scan_complete":
        console.print(f"\n[bold green]✓ {event.message}[/bold green]")
    elif event.type == "scan_error":
        console.print(f"\n[bold red]✗ {event.message}[/bold red]")


def _render_report(report: ReconReport) -> None:
    target_type = report.target_type
    header = Text()
    header.append("RILEY OSINT Recon", style="bold")
    header.append(f"\n{report.target}", style="bold cyan")
    header.append(f"  ({target_type})", style="dim")
    console.print(Panel(header, border_style="cyan"))

    # Tool results table
    table = Table(title="OSINT Results", show_header=True, header_style="bold")
    table.add_column("Module", style="cyan")
    table.add_column("Tool")
    table.add_column("Status")
    table.add_column("Summary")

    for r in report.tool_results:
        summary = ""
        if r.status == "ok" and r.data:
            keys = list(r.data.keys())[:3]
            summary = ", ".join(f"{k}={r.data[k]}" for k in keys if r.data[k] is not None)[:80]
        elif r.error:
            summary = r.error[:60]
        table.add_row(
            r.module,
            r.tool,
            f"[{_status_style(r.status)}]{r.status}[/]",
            summary,
        )
    console.print(table)

    if report.assessment:
        a = report.assessment
        risk_colors = {
            "low": "green",
            "medium": "yellow",
            "high": "red",
            "critical": "bold red",
        }
        color = risk_colors.get(a.risk_level, "white")
        console.print(
            Panel(
                f"[{color}]{a.risk_level.upper()} — {a.risk_score}/100[/{color}]\n\n"
                f"{a.threat_summary}\n\n"
                f"[bold]IOCs:[/bold] {', '.join(a.iocs[:10]) or 'none'}\n\n"
                f"[bold]Recommendations:[/bold]\n{a.recommendations}\n\n"
                f"[dim]{a.analyst_rationale}[/dim]",
                title="Risk Assessment",
                border_style=color,
            )
        )

    if report.synthesis and report.synthesis.key_findings:
        console.print("\n[bold]Key Findings[/bold]")
        for i, finding in enumerate(report.synthesis.key_findings, 1):
            console.print(f"  {i}. {finding}")

    if report.duration_ms:
        console.print(f"\n[dim]Completed in {report.duration_ms}ms[/dim]")


@app.command()
def scan(
    target: Annotated[str, typer.Argument(help="Domain, IP, email, username, URL, or hash")],
    modules: Annotated[
        Optional[str],
        typer.Option("--modules", "-m", help="Comma-separated: dns,domain,email,social,tech,breach,threat"),
    ] = None,
    no_ai: Annotated[bool, typer.Option("--no-ai", help="Skip LLM synthesis pipeline")] = False,
    json_output: Annotated[bool, typer.Option("--json", help="Output raw JSON report")] = False,
    output: Annotated[
        Optional[Path],
        typer.Option("--output", "-o", help="Write JSON report to file"),
    ] = None,
) -> None:
    """Run full OSINT recon against a target."""
    target_type = detect_target_type(target)
    parsed_modules = _parse_modules(modules)

    if not json_output:
        console.print(f"\n[bold]Target:[/bold] {target} → [cyan]{target_type}[/cyan]")
        if parsed_modules:
            console.print(f"[dim]Modules: {', '.join(m.value for m in parsed_modules)}[/dim]")
        console.print()

    report = asyncio.run(
        run_recon(
            target,
            modules=parsed_modules,
            use_ai=not no_ai,
            on_event=None if json_output else _render_event,
        )
    )

    if json_output:
        console.print(report.model_dump_json(indent=2))
    elif not json_output:
        console.print()
        _render_report(report)

    if output:
        output.write_text(report.model_dump_json(indent=2))
        if not json_output:
            console.print(f"\n[dim]Report saved to {output}[/dim]")


@app.command()
def tools() -> None:
    """List available OSINT modules and tools."""
    from riley_osint.tools import TOOLS_BY_MODULE

    table = Table(title="RILEY OSINT Tools", show_header=True, header_style="bold")
    table.add_column("Module", style="cyan")
    table.add_column("Tool")
    table.add_column("Requires API Key")

    key_required = {
        "Hunter.io": "HUNTER_API_KEY",
        "Have I Been Pwned": "HIBP_API_KEY",
        "VirusTotal": "VIRUSTOTAL_API_KEY",
        "AbuseIPDB": "ABUSEIPDB_API_KEY",
        "Shodan": "SHODAN_API_KEY",
        "AlienVault OTX": "OTX_API_KEY (optional)",
        "GreyNoise": "GREYNOISE_API_KEY (optional)",
        "ipinfo.io": "IPINFO_TOKEN (optional)",
    }

    for module, tool_list in TOOLS_BY_MODULE.items():
        for tool in tool_list:
            table.add_row(module, tool.name, key_required.get(tool.name, "No"))
    console.print(table)


if __name__ == "__main__":
    app()
