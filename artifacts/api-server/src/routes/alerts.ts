import { Router, type IRouter } from "express";
import { eq, desc, ilike, or, and, inArray, type SQL } from "drizzle-orm";
import { db, alertsTable } from "@workspace/db";
import {
  ListAlertsQueryParams,
  ListAlertsResponse,
  GetAlertParams,
  GetAlertResponse,
  UpdateAlertStatusParams,
  UpdateAlertStatusBody,
  UpdateAlertStatusResponse,
  SimulateAlertsBody,
  SimulateAlertsResponse,
  BulkUpdateAlertsBody,
  BulkUpdateAlertsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const TITLES = [
  "Suspicious PowerShell execution chain",
  "Anomalous outbound beacon pattern",
  "Known admin tool execution",
  "Lateral movement detected",
  "Credential dumping attempt",
  "Unusual login geo velocity",
  "Chrome auto-update flagged",
  "Privilege escalation via scheduled task",
  "C2 beacon pattern match",
  "Brute-force login attempts",
  "Data exfiltration to unknown host",
  "Registry persistence mechanism created",
  "Suspicious DNS tunneling activity",
  "Unsigned binary execution in temp dir",
  "Mimikatz-like memory access pattern",
];

const SOURCES = ["CrowdStrike", "Splunk", "SentinelOne", "MS Sentinel", "Okta", "Zscaler"];
const SEVERITIES = ["low", "medium", "high", "critical"] as const;
const TACTICS = [
  "Initial Access",
  "Execution",
  "Persistence",
  "Privilege Escalation",
  "Defense Evasion",
  "Credential Access",
  "Lateral Movement",
  "Exfiltration",
  "Command and Control",
];
const ASSET_PREFIXES = ["LON-SRV", "SFO-WS", "TKY-WS", "BER-SRV", "NYC-WS", "AMS-SRV"];

// Title-keyed realistic descriptions — each title has 3-4 technically specific variants
// so the AI receives meaningful forensic signal rather than boilerplate.
const DESCRIPTIONS: Record<string, string[]> = {
  "Suspicious PowerShell execution chain": [
    "powershell.exe spawned from winword.exe with encoded command: -EncodedCommand SQBFAFgA...; outbound connection to 185.220.101.45:443 initiated within 2 seconds. Parent chain: winword.exe → cmd.exe → powershell.exe.",
    "PowerShell child process under explorer.exe with flags -ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden; process tree shows cmd.exe → powershell.exe → net.exe; 'net localgroup administrators' captured in command line.",
    "Scheduled task 'WindowsUpdate' registered by powershell.exe; action: powershell.exe -WindowStyle Hidden -File C:\\Users\\Public\\upd.ps1; task created 3 minutes after an unsigned script was written to C:\\Users\\Public\\.",
    "Obfuscated PowerShell: IEX(New-Object Net.WebClient).DownloadString() contacted raw.githubusercontent.com; AMSI patching pattern detected in process memory before execution; Defender signatures bypassed.",
  ],
  "Anomalous outbound beacon pattern": [
    "HTTP GET to 104.21.87.203 every 60±2 seconds over 4 hours; User-Agent: Mozilla/4.0 (compatible; MSIE 7.0); 256-byte response payload is constant; jitter variance and sleep timing match Cobalt Strike default beacon profile.",
    "DNS queries to randomized subdomains of updates-cdn.net at 120-second intervals; subdomain entropy 4.2 bits (baseline 1.1); no legitimate CDN PTR record; source process: svchost.exe PID 2204 not matching any known Windows service.",
    "TLS 1.2 sessions to 91.195.240.8:443; JA3 fingerprint 769,47-53-5-10-49171-49172,0-65281-23,0,0 matches Metasploit meterpreter; certificate issued 6 hours before first connection; keepalive every 30s.",
  ],
  "Known admin tool execution": [
    "psexec.exe executed targeting remote host via SMB; command includes explicit domain credentials; Event ID 4648 (explicit credential logon) logged 2 seconds prior; source account is non-IT user with no documented admin access.",
    "wmic.exe invocation: process call create 'cmd.exe /c whoami > C:\\temp\\out.txt' on remote host; executed by svc_monitor service account which has no historical WMIC usage; output file subsequently compressed and copied to network share.",
    "sysinternals\\procdump64.exe -ma lsass.exe lsass.dmp executed under SYSTEM context; dump file created in C:\\Windows\\Temp\\; 7z.exe immediately compressed the dump — classic credential-harvesting sequence before lateral movement.",
  ],
  "Lateral movement detected": [
    "SMB connections from single source to 6 internal hosts within 4 minutes on port 445; IPC$ share accessed sequentially; net use with domain admin credentials observed; NTLM authentication used exclusively (no Kerberos).",
    "WMI lateral movement: wbemcons service spawned cmd.exe on target host; source authenticated via Pass-the-Hash (NTLMv2 without password knowledge); Event IDs 4624 (type 3) and 4648 logged in rapid succession.",
    "RDP connection using account whose last successful authentication was from a different continent 8 minutes earlier; velocity check: 9,547 km in 8 minutes is physically impossible; MFA not triggered on new session.",
  ],
  "Credential dumping attempt": [
    "lsass.exe accessed by unsigned rundll32.exe; MiniDumpWriteDump API call detected in ETW trace; output file c:\\programdata\\debug.bin written; parent: explorer.exe → rundll32.exe; no legitimate dump tooling documented for this host.",
    "SAM, SYSTEM, and SECURITY registry hives read sequentially via reg.exe save to C:\\Users\\Public\\Documents\\; files copied to mapped network share within 30 seconds — consistent with offline NTLM hash extraction preparation.",
    "DCSync attack: DsGetNCChanges() called on domain controller from non-DC workstation using domain admin account; replication rights not provisioned for source account; 847 account objects replicated in 12 seconds.",
  ],
  "Unusual login geo velocity": [
    "Account authenticated from London UK (82.132.210.4) at 14:32 UTC; same account authenticated from Seoul KR (175.45.176.3) at 14:39 UTC — 7-minute gap covers 8,950 km; physical travel speed required: 76,714 km/h.",
    "Okta authentication for corporate account from AWS datacenter IP (us-west-2 region — not residential or corporate); prior 30-day pattern shows London office exclusively; no VPN or business travel record; device fingerprint unrecognized.",
    "Account authenticated at 03:15 local time (off-hours); Okta risk score 78/100; device fingerprint new and unrecognized; MFA push notification sent to registered device — user subsequently reported not initiating any login.",
  ],
  "Chrome auto-update flagged": [
    "chrome.exe executed from C:\\Users\\AppData\\Local\\Temp\\CRX_7B4A\\chrome.exe (non-standard path); PE compilation timestamp 2019; Authenticode signature expired 4 years ago; standard Chrome path C:\\Program Files\\Google\\Chrome\\ shows separate unmodified binary.",
    "GoogleUpdate.exe initiated connection to internal IP 192.168.100.5 instead of Google update servers; DNS attempted for update.googleapis.com.corp.internal (internal suffix appended — SSRF indicator); Chrome update process should exclusively contact google.com.",
    "Chrome extension silently installed (ID: gbmgkahjioeacddebbnenddkjkladhmk); manifest requests host_permissions for <all_urls>; background service worker contacts exfil-cdn.net every 90 seconds; no user prompt or installation record in Chrome admin console.",
  ],
  "Privilege escalation via scheduled task": [
    "schtasks.exe /create /sc ONLOGON /tn 'MicrosoftEdgeUpdateTaskMachineCore' /tr 'C:\\Windows\\System32\\cmd.exe /c C:\\ProgramData\\intel\\svc.exe' /ru SYSTEM; task name mimics legitimate Edge update service; svc.exe unsigned, first seen 6 hours ago.",
    "Task Scheduler ITaskService::NewTask API called by low-privilege user account; task action runs unsigned batch file as SYSTEM; UAC auto-elevation exploited via fodhelper.exe; Event ID 4698 (scheduled task created) without preceding 4697.",
    "Existing scheduled task binary path modified from legitimate application to C:\\Temp\\update.exe at 02:17 AM; modification timestamp outside business hours; hash of replacement binary matches RAT dropper (VirusTotal 34/72 detections).",
  ],
  "C2 beacon pattern match": [
    "TLS session from chrome.exe to 45.142.212.100:8443; JA3S fingerprint matches Cobalt Strike Team Server default configuration; cert CN is typosquatting government domain; 492-byte encrypted payload transmitted every 60 seconds.",
    "DNS-over-HTTPS exfiltration: base64-encoded data in TXT record queries to recursive resolver; 340 queries/hour vs baseline 12; queries originate from svchost.exe PID 1088 (netsvcs) — not a process that should generate TXT queries; estimated exfil rate 4 KB/min.",
    "Sliver C2 framework signature: HTTP beacon with X-Forwarded-For header containing encoded implant config; URI pattern /api/v1/[8-char-hex]/update; beacon interval jitter ±15%; traffic originates from regsvr32.exe (LOLBAS execution).",
  ],
  "Brute-force login attempts": [
    "4,847 failed SSH authentication attempts against host from 5 source IPs over 22 minutes; username list includes admin, root, ubuntu, deploy, git; rate ~220 attempts/minute; 2 successful authentications detected at end of burst.",
    "O365 credential-spray: password 'Summer2024!' attempted against 340 accounts; 11 successful authentications; attack cadence 1 attempt per account per 30 minutes to avoid lockout threshold; source IP is Tor exit node.",
    "RDP brute force: Event ID 4625 (failed logon) × 2,200 in 8 minutes from internal pivot IP; all attempts targeting local Administrator account; source is lateral movement host, not external; Event ID 4624 success logged at end of sequence.",
  ],
  "Data exfiltration to unknown host": [
    "curl.exe uploaded 847 MB to transfer.sh at 11.2 MB/s; parent process: python.exe → cmd.exe; archive created by 7z.exe from Q3-Financials documents directory; transfer initiated at 02:30 AM — outside all business-hours baselines.",
    "Outbound HTTPS to Mega.nz CDN IP range: 1.2 GB transferred over 40 minutes; source process syncapp.exe not in application whitelist; daily bandwidth baseline for this host is 50 MB; no prior Mega.nz connections in 90-day history.",
    "SFTP session to external IP (Telegram CDN range); 320 files transferred matching *.xlsx *.pdf *.docx; total 2.4 GB; initiating account is a service account with no documented SFTP access requirement or authorization.",
  ],
  "Registry persistence mechanism created": [
    "Registry key HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run\\WindowsDefenderSvc set to C:\\ProgramData\\Microsoft\\windows\\svc.exe; binary unsigned, created 4 minutes before registry write; value name mimics Windows Defender service.",
    "New service key written to HKLM\\SYSTEM\\CurrentControlSet\\Services\\[random-8-char]\\ImagePath pointing to C:\\Windows\\Temp\\svchost.dll; service type set to kernel driver; no corresponding PnP device manager entry; persists across reboot.",
    "COM hijacking: HKCU\\Software\\Classes\\CLSID\\{B5F8350B-0548-48B1-A6EE-88BD00B4A5E7}\\InprocServer32 set to C:\\Users\\Public\\mal.dll; this CLSID is loaded by explorer.exe at startup; DLL will execute with explorer token on next logon.",
  ],
  "Suspicious DNS tunneling activity": [
    "DNS TXT queries to c2.tunneldomain.xyz contain base64 payloads; average query length 220 bytes (DNS baseline 40 bytes); 1,800 queries in 30 minutes with no corresponding HTTP/HTTPS; traffic profile matches iodine or dns2tcp tunneling tool.",
    "DGA pattern: subdomain queries to [8-hex-char].update-services.net cycling through generated names; NXDOMAIN rate 94%; algorithm seed matches current date; process creation event 4 minutes prior to first DNS query from this domain.",
    "nslookup.exe issued 340 TXT record queries to [base64].exfil.attacker-domain.com; each subdomain encodes ~200 bytes; estimated total exfiltration 68 KB; parent chain: mshta.exe → cmd.exe → nslookup.exe (LOLBAS execution chain).",
  ],
  "Unsigned binary execution in temp dir": [
    "C:\\Users\\AppData\\Local\\Temp\\IXP000.TMP\\setup.exe executed; PE timestamp 2019 (likely forged); no Authenticode signature; entropy 7.8 indicating packed or encrypted payload; spawned powershell.exe within 2 seconds and established outbound connection.",
    "C:\\Windows\\Temp\\mspaint.exe executed — filename spoofs a system binary; SHA256 does not match any known-good mspaint.exe; parent: msiexec.exe loading from remote URL; UAC elevation succeeded silently via DLL planting.",
    "Unsigned DLL loaded into svchost.exe via side-loading: C:\\Program Files\\Common Files\\microsoft shared\\Update\\msi.dll (non-standard path); loaded alongside legitimate vcruntime140.dll; DLL first seen on filesystem 9 minutes before execution.",
  ],
  "Mimikatz-like memory access pattern": [
    "Process opened lsass.exe (PID 720) with access rights PROCESS_VM_READ | PROCESS_QUERY_INFORMATION; calling process masquerades as svchost.exe but binary is not in System32; Sysmon Event ID 10 GrantedAccess 0x1010.",
    "ReadProcessMemory calls to lsass.exe targeting offsets matching WDIGEST authentication package memory layout; 32 credential structures identified in access pattern; calling process is named 'Windows Error Reporting' but binary hash does not match legitimate WER.",
    "Unsigned kernel driver loaded (Sysmon Event ID 6); ETW trace shows PreviousMode manipulation on lsass.exe process object — technique used to bypass PPL (Protected Process Light) protection; driver not present in Microsoft driver catalog.",
  ],
};

function randomFrom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

function randomAlertId(): string {
  return `AL-${Math.floor(100000 + Math.random() * 900000)}`;
}

function pickDescription(title: string): string {
  const options = DESCRIPTIONS[title];
  if (options && options.length > 0) {
    return randomFrom(options);
  }
  return `Security event detected. Alert: "${title}". Requires analyst review.`;
}

function generateSyntheticAlert() {
  const severity = randomFrom(SEVERITIES);
  const title = randomFrom(TITLES);
  const confidence =
    severity === "critical" || severity === "high"
      ? 0.7 + Math.random() * 0.29
      : Math.random() * 0.65;
  return {
    alertId: randomAlertId(),
    title,
    description: pickDescription(title),
    source: randomFrom(SOURCES),
    severity,
    status: "pending" as const,
    confidence: Number(confidence.toFixed(2)),
    assetName: `${randomFrom(ASSET_PREFIXES)}-${Math.floor(1000 + Math.random() * 9000)}`,
    mitreTactic: randomFrom(TACTICS),
  };
}

router.get("/alerts", async (req, res): Promise<void> => {
  const parsed = ListAlertsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const conditions: SQL[] = [];
  if (parsed.data.status) {
    conditions.push(eq(alertsTable.status, parsed.data.status));
  }
  if (parsed.data.search) {
    const term = `%${parsed.data.search}%`;
    const clause = or(
      ilike(alertsTable.title, term),
      ilike(alertsTable.assetName, term),
      ilike(alertsTable.alertId, term),
    );
    if (clause) conditions.push(clause);
  }

  const rows = await db
    .select()
    .from(alertsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(alertsTable.createdAt));

  res.json(ListAlertsResponse.parse(rows));
});

router.post("/alerts/simulate", async (req, res): Promise<void> => {
  const parsed = SimulateAlertsBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const count = parsed.data.count ?? 5;
  const newAlerts = Array.from({ length: count }, generateSyntheticAlert);

  const inserted = await db.insert(alertsTable).values(newAlerts).returning();

  req.log.info({ count: inserted.length }, "Simulated new alerts");
  res.status(201).json(SimulateAlertsResponse.parse(inserted));
});

router.get("/alerts/:id", async (req, res): Promise<void> => {
  const params = GetAlertParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [alert] = await db
    .select()
    .from(alertsTable)
    .where(eq(alertsTable.id, params.data.id));

  if (!alert) {
    res.status(404).json({ error: "Alert not found" });
    return;
  }

  res.json(GetAlertResponse.parse(alert));
});

router.patch("/alerts/:id", async (req, res): Promise<void> => {
  const params = UpdateAlertStatusParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateAlertStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [alert] = await db
    .update(alertsTable)
    .set({ status: parsed.data.status })
    .where(eq(alertsTable.id, params.data.id))
    .returning();

  if (!alert) {
    res.status(404).json({ error: "Alert not found" });
    return;
  }

  res.json(UpdateAlertStatusResponse.parse(alert));
});

router.patch("/alerts/bulk", async (req, res): Promise<void> => {
  const parsed = BulkUpdateAlertsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { ids, status } = parsed.data;

  await db
    .update(alertsTable)
    .set({ status })
    .where(inArray(alertsTable.id, ids));

  req.log.info({ count: ids.length, status }, "Bulk updated alerts");
  res.json(BulkUpdateAlertsResponse.parse({ updatedCount: ids.length, status }));
});

export default router;
export { generateSyntheticAlert };
