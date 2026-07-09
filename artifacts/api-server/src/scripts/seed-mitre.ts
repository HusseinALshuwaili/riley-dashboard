/**
 * MITRE ATT&CK Technique Seeder
 *
 * One-time script to populate the mitre_techniques table with embeddings.
 * Run with:
 *   cd artifacts/api-server
 *   DATABASE_URL=... JINA_API_KEY=... npx tsx src/scripts/seed-mitre.ts
 *
 * Prereq: Run the pgvector SQL in the Neon console first:
 *   CREATE EXTENSION IF NOT EXISTS vector;
 *   CREATE TABLE IF NOT EXISTS mitre_techniques ( ... ) -- see docs
 */

import { pool } from "@workspace/db";
import { embedBatch } from "../lib/rag/jina";

// ---------------------------------------------------------------------------
// Curated MITRE ATT&CK Enterprise technique dataset
// Covers all 14 tactics with the most commonly observed techniques
// ---------------------------------------------------------------------------

interface TechniqueRecord {
  tacticId:        string;
  tactic:          string;
  techniqueId:     string;
  technique:       string;
  subTechniqueId?: string;
  subTechnique?:   string;
  description:     string;
  platforms:       string[];
  exampleTools:    string[];
}

const TECHNIQUES: TechniqueRecord[] = [
  // ── Initial Access (TA0001) ────────────────────────────────────────────────
  {
    tacticId: "TA0001", tactic: "Initial Access",
    techniqueId: "T1566", technique: "Phishing",
    description: "Adversaries send phishing messages with malicious attachments or links to gain initial access. Spearphishing targets specific individuals with personalized lures. Messages may contain malicious macros, exploits, or credential harvesting pages.",
    platforms: ["Windows", "macOS", "Linux", "Office 365", "Google Workspace"],
    exampleTools: ["GoPhish", "SET", "Evilginx2"],
  },
  {
    tacticId: "TA0001", tactic: "Initial Access",
    techniqueId: "T1566", technique: "Phishing",
    subTechniqueId: "T1566.001", subTechnique: "Spearphishing Attachment",
    description: "Adversaries send spearphishing emails with malicious file attachments. Common file types include Office documents with macros, PDFs with embedded exploits, and archives containing executables.",
    platforms: ["Windows", "macOS", "Linux"],
    exampleTools: ["Metasploit", "Cobalt Strike", "msfvenom"],
  },
  {
    tacticId: "TA0001", tactic: "Initial Access",
    techniqueId: "T1190", technique: "Exploit Public-Facing Application",
    description: "Adversaries exploit weaknesses in internet-facing applications like web servers, databases, or VPN gateways to gain initial access. Includes SQL injection, RCE vulnerabilities, and deserialization flaws.",
    platforms: ["Windows", "Linux", "macOS", "Containers", "Network"],
    exampleTools: ["SQLMap", "Metasploit", "Shodan"],
  },
  {
    tacticId: "TA0001", tactic: "Initial Access",
    techniqueId: "T1133", technique: "External Remote Services",
    description: "Adversaries leverage external remote services such as VPNs, Citrix, RDP, and SSH as entry points. Often paired with valid credentials obtained through other means.",
    platforms: ["Windows", "Linux", "macOS"],
    exampleTools: ["Hydra", "CrackMapExec", "Impacket"],
  },
  {
    tacticId: "TA0001", tactic: "Initial Access",
    techniqueId: "T1078", technique: "Valid Accounts",
    description: "Adversaries use compromised credentials to gain initial access. Accounts may be obtained through credential dumping, phishing, or purchasing stolen credentials. Includes domain, cloud, and local accounts.",
    platforms: ["Windows", "Linux", "macOS", "AWS", "Azure", "GCP"],
    exampleTools: ["Mimikatz", "LaZagne", "BloodHound"],
  },
  {
    tacticId: "TA0001", tactic: "Initial Access",
    techniqueId: "T1195", technique: "Supply Chain Compromise",
    description: "Adversaries compromise software or hardware supply chains before delivery to end users. Includes tampering with build processes, source code repositories, or distribution mechanisms.",
    platforms: ["Windows", "Linux", "macOS"],
    exampleTools: ["SolarWinds SUNBURST", "NotPetya (M.E.Doc)"],
  },

  // ── Execution (TA0002) ────────────────────────────────────────────────────
  {
    tacticId: "TA0002", tactic: "Execution",
    techniqueId: "T1059", technique: "Command and Scripting Interpreter",
    description: "Adversaries abuse command-line interfaces and scripting environments to execute malicious code. Includes PowerShell, Bash, Python, VBScript, and WMI.",
    platforms: ["Windows", "macOS", "Linux"],
    exampleTools: ["PowerShell Empire", "Covenant", "Metasploit"],
  },
  {
    tacticId: "TA0002", tactic: "Execution",
    techniqueId: "T1059", technique: "Command and Scripting Interpreter",
    subTechniqueId: "T1059.001", subTechnique: "PowerShell",
    description: "Adversaries use PowerShell commands and scripts to execute malicious code. PowerShell is built into Windows and provides powerful access to system functions. Used for download cradles, in-memory execution, and lateral movement.",
    platforms: ["Windows"],
    exampleTools: ["PowerShell Empire", "Cobalt Strike", "Invoke-Mimikatz"],
  },
  {
    tacticId: "TA0002", tactic: "Execution",
    techniqueId: "T1053", technique: "Scheduled Task/Job",
    description: "Adversaries abuse task scheduling functionality to execute malicious code at specified times or intervals. Used for persistence, privilege escalation, and lateral movement.",
    platforms: ["Windows", "Linux", "macOS", "Containers"],
    exampleTools: ["schtasks.exe", "cron", "at.exe"],
  },
  {
    tacticId: "TA0002", tactic: "Execution",
    techniqueId: "T1203", technique: "Exploitation for Client Execution",
    description: "Adversaries exploit vulnerabilities in client-side applications such as browsers, document readers, or media players to execute malicious code.",
    platforms: ["Windows", "macOS", "Linux"],
    exampleTools: ["Metasploit browser exploits", "CVE-2021-40444"],
  },

  // ── Persistence (TA0003) ──────────────────────────────────────────────────
  {
    tacticId: "TA0003", tactic: "Persistence",
    techniqueId: "T1547", technique: "Boot or Logon Autostart Execution",
    description: "Adversaries configure system settings to execute malicious programs during boot or logon. Includes registry run keys, startup folders, and init scripts.",
    platforms: ["Windows", "macOS", "Linux"],
    exampleTools: ["Registry modification", "cron jobs", "launchd"],
  },
  {
    tacticId: "TA0003", tactic: "Persistence",
    techniqueId: "T1543", technique: "Create or Modify System Process",
    description: "Adversaries create or modify system-level processes to execute malicious code on a recurring basis. Includes Windows services, systemd units, and launch daemons.",
    platforms: ["Windows", "macOS", "Linux"],
    exampleTools: ["sc.exe", "systemctl", "launchctl"],
  },
  {
    tacticId: "TA0003", tactic: "Persistence",
    techniqueId: "T1136", technique: "Create Account",
    description: "Adversaries create accounts to maintain persistent access. Includes local accounts, domain accounts, and cloud provider accounts.",
    platforms: ["Windows", "Linux", "macOS", "AWS", "Azure", "GCP"],
    exampleTools: ["net user", "useradd", "aws iam create-user"],
  },
  {
    tacticId: "TA0003", tactic: "Persistence",
    techniqueId: "T1505", technique: "Server Software Component",
    subTechniqueId: "T1505.003", subTechnique: "Web Shell",
    description: "Adversaries install web shells on compromised web servers to maintain persistent access and execute commands. Web shells are scripts that provide remote access through HTTP/HTTPS.",
    platforms: ["Windows", "Linux", "macOS", "Network"],
    exampleTools: ["China Chopper", "Weevely", "JSP WebShell"],
  },

  // ── Privilege Escalation (TA0004) ─────────────────────────────────────────
  {
    tacticId: "TA0004", tactic: "Privilege Escalation",
    techniqueId: "T1068", technique: "Exploitation for Privilege Escalation",
    description: "Adversaries exploit software vulnerabilities to elevate privileges. Common targets include OS kernels, device drivers, and privileged services.",
    platforms: ["Windows", "Linux", "macOS"],
    exampleTools: ["CVE-2021-3156 (Baron Samedit)", "PrintNightmare", "Dirty COW"],
  },
  {
    tacticId: "TA0004", tactic: "Privilege Escalation",
    techniqueId: "T1055", technique: "Process Injection",
    description: "Adversaries inject malicious code into legitimate processes to evade defenses and elevate privileges. Techniques include DLL injection, process hollowing, and reflective loading.",
    platforms: ["Windows", "Linux", "macOS"],
    exampleTools: ["Cobalt Strike", "Metasploit", "Donut"],
  },
  {
    tacticId: "TA0004", tactic: "Privilege Escalation",
    techniqueId: "T1548", technique: "Abuse Elevation Control Mechanism",
    subTechniqueId: "T1548.002", subTechnique: "Bypass User Account Control",
    description: "Adversaries bypass Windows User Account Control (UAC) to execute processes with elevated privileges without triggering user prompts.",
    platforms: ["Windows"],
    exampleTools: ["UACME", "Eventvwr UAC bypass", "fodhelper.exe"],
  },

  // ── Defense Evasion (TA0005) ───────────────────────────────────────────────
  {
    tacticId: "TA0005", tactic: "Defense Evasion",
    techniqueId: "T1027", technique: "Obfuscated Files or Information",
    description: "Adversaries obfuscate malicious payloads to make detection difficult. Techniques include encoding (Base64, XOR), encryption, packing, and steganography.",
    platforms: ["Windows", "Linux", "macOS", "Network"],
    exampleTools: ["Veil", "PyFuscation", "Invoke-Obfuscation"],
  },
  {
    tacticId: "TA0005", tactic: "Defense Evasion",
    techniqueId: "T1562", technique: "Impair Defenses",
    subTechniqueId: "T1562.001", subTechnique: "Disable or Modify Tools",
    description: "Adversaries disable or modify security tools to prevent detection. Includes disabling antivirus, EDR agents, logging mechanisms, and firewall rules.",
    platforms: ["Windows", "Linux", "macOS"],
    exampleTools: ["PowerShell", "reg.exe", "sc.exe"],
  },
  {
    tacticId: "TA0005", tactic: "Defense Evasion",
    techniqueId: "T1070", technique: "Indicator Removal",
    subTechniqueId: "T1070.001", subTechnique: "Clear Windows Event Logs",
    description: "Adversaries delete or alter system event logs to remove evidence of their activities. Targets Windows Event Log, syslog, and application logs.",
    platforms: ["Windows"],
    exampleTools: ["wevtutil.exe", "PowerShell Clear-EventLog"],
  },
  {
    tacticId: "TA0005", tactic: "Defense Evasion",
    techniqueId: "T1036", technique: "Masquerading",
    description: "Adversaries disguise malicious files, processes, or services as legitimate ones. Includes renaming executables, using similar filenames, and hijacking legitimate process names.",
    platforms: ["Windows", "Linux", "macOS"],
    exampleTools: ["LOLBAS", "Living-off-the-land binaries"],
  },
  {
    tacticId: "TA0005", tactic: "Defense Evasion",
    techniqueId: "T1218", technique: "System Binary Proxy Execution",
    subTechniqueId: "T1218.011", subTechnique: "Rundll32",
    description: "Adversaries use rundll32.exe to execute malicious DLLs while evading defenses that may not monitor this legitimate Windows process.",
    platforms: ["Windows"],
    exampleTools: ["rundll32.exe", "regsvr32.exe", "mshta.exe"],
  },

  // ── Credential Access (TA0006) ────────────────────────────────────────────
  {
    tacticId: "TA0006", tactic: "Credential Access",
    techniqueId: "T1003", technique: "OS Credential Dumping",
    description: "Adversaries dump credentials from operating system memory, files, or registry. Targets include LSASS memory, SAM database, NTDS.dit, and /etc/shadow.",
    platforms: ["Windows", "Linux", "macOS"],
    exampleTools: ["Mimikatz", "ProcDump", "secretsdump.py"],
  },
  {
    tacticId: "TA0006", tactic: "Credential Access",
    techniqueId: "T1003", technique: "OS Credential Dumping",
    subTechniqueId: "T1003.001", subTechnique: "LSASS Memory",
    description: "Adversaries access LSASS process memory to extract plaintext credentials, password hashes, and Kerberos tickets from logged-on users.",
    platforms: ["Windows"],
    exampleTools: ["Mimikatz", "ProcDump", "Task Manager memory dump"],
  },
  {
    tacticId: "TA0006", tactic: "Credential Access",
    techniqueId: "T1110", technique: "Brute Force",
    description: "Adversaries attempt to gain access to accounts using systematic guessing of credentials. Includes password spraying, credential stuffing, and dictionary attacks.",
    platforms: ["Windows", "Linux", "macOS", "AWS", "Azure", "Office 365"],
    exampleTools: ["Hydra", "Medusa", "Spray"],
  },
  {
    tacticId: "TA0006", tactic: "Credential Access",
    techniqueId: "T1555", technique: "Credentials from Password Stores",
    description: "Adversaries search for credentials stored in password managers, browsers, and OS credential stores.",
    platforms: ["Windows", "Linux", "macOS"],
    exampleTools: ["LaZagne", "BrowserStealer", "KeeThief"],
  },
  {
    tacticId: "TA0006", tactic: "Credential Access",
    techniqueId: "T1558", technique: "Steal or Forge Kerberos Tickets",
    subTechniqueId: "T1558.003", subTechnique: "Kerberoasting",
    description: "Adversaries request service tickets for service accounts and crack them offline to obtain plaintext passwords.",
    platforms: ["Windows"],
    exampleTools: ["Rubeus", "Impacket GetUserSPNs.py", "Invoke-Kerberoast"],
  },

  // ── Discovery (TA0007) ────────────────────────────────────────────────────
  {
    tacticId: "TA0007", tactic: "Discovery",
    techniqueId: "T1082", technique: "System Information Discovery",
    description: "Adversaries gather detailed information about the compromised system including OS version, hostname, hardware, and installed software.",
    platforms: ["Windows", "Linux", "macOS"],
    exampleTools: ["systeminfo.exe", "uname", "wmic"],
  },
  {
    tacticId: "TA0007", tactic: "Discovery",
    techniqueId: "T1046", technique: "Network Service Discovery",
    description: "Adversaries scan the network to identify active hosts and open ports. Used to map the target environment and identify further targets for lateral movement.",
    platforms: ["Windows", "Linux", "macOS"],
    exampleTools: ["Nmap", "Masscan", "AngryIPScanner"],
  },
  {
    tacticId: "TA0007", tactic: "Discovery",
    techniqueId: "T1083", technique: "File and Directory Discovery",
    description: "Adversaries enumerate files and directories on compromised systems to identify sensitive data, configuration files, and credentials.",
    platforms: ["Windows", "Linux", "macOS"],
    exampleTools: ["dir", "ls", "find", "Everything"],
  },
  {
    tacticId: "TA0007", tactic: "Discovery",
    techniqueId: "T1057", technique: "Process Discovery",
    description: "Adversaries enumerate running processes to understand the environment, identify security tools, and find processes to inject into.",
    platforms: ["Windows", "Linux", "macOS"],
    exampleTools: ["tasklist.exe", "ps", "Get-Process"],
  },
  {
    tacticId: "TA0007", tactic: "Discovery",
    techniqueId: "T1018", technique: "Remote System Discovery",
    description: "Adversaries enumerate systems on the network to identify additional targets. Uses ARP tables, DNS queries, Windows net commands, and Active Directory queries.",
    platforms: ["Windows", "Linux", "macOS"],
    exampleTools: ["net view", "nbtstat", "BloodHound"],
  },
  {
    tacticId: "TA0007", tactic: "Discovery",
    techniqueId: "T1087", technique: "Account Discovery",
    description: "Adversaries enumerate user accounts on local systems and domain controllers to identify targets for credential attacks and privilege escalation.",
    platforms: ["Windows", "Linux", "macOS", "AWS", "Azure"],
    exampleTools: ["net user", "ldapsearch", "BloodHound"],
  },

  // ── Lateral Movement (TA0008) ─────────────────────────────────────────────
  {
    tacticId: "TA0008", tactic: "Lateral Movement",
    techniqueId: "T1021", technique: "Remote Services",
    description: "Adversaries use valid credentials to authenticate to remote services for lateral movement. Includes RDP, SSH, SMB, WinRM, and VNC.",
    platforms: ["Windows", "Linux", "macOS"],
    exampleTools: ["CrackMapExec", "Impacket", "PsExec"],
  },
  {
    tacticId: "TA0008", tactic: "Lateral Movement",
    techniqueId: "T1021", technique: "Remote Services",
    subTechniqueId: "T1021.002", subTechnique: "SMB/Windows Admin Shares",
    description: "Adversaries use valid credentials to connect to Windows administrative shares (C$, ADMIN$, IPC$) and execute commands remotely.",
    platforms: ["Windows"],
    exampleTools: ["PsExec", "CrackMapExec", "Impacket smbexec"],
  },
  {
    tacticId: "TA0008", tactic: "Lateral Movement",
    techniqueId: "T1550", technique: "Use Alternate Authentication Material",
    subTechniqueId: "T1550.002", subTechnique: "Pass the Hash",
    description: "Adversaries use captured NTLM password hashes to authenticate to remote systems without knowing the plaintext password.",
    platforms: ["Windows"],
    exampleTools: ["Mimikatz", "CrackMapExec", "Impacket"],
  },
  {
    tacticId: "TA0008", tactic: "Lateral Movement",
    techniqueId: "T1570", technique: "Lateral Tool Transfer",
    description: "Adversaries transfer malicious tools and files to compromised systems during lateral movement using SMB, RDP clipboard, SCP, or FTP.",
    platforms: ["Windows", "Linux", "macOS"],
    exampleTools: ["certutil.exe", "bitsadmin.exe", "scp"],
  },

  // ── Collection (TA0009) ───────────────────────────────────────────────────
  {
    tacticId: "TA0009", tactic: "Collection",
    techniqueId: "T1005", technique: "Data from Local System",
    description: "Adversaries collect data stored on local file systems including documents, databases, email archives, and configuration files.",
    platforms: ["Windows", "Linux", "macOS"],
    exampleTools: ["robocopy", "xcopy", "PowerShell Get-ChildItem"],
  },
  {
    tacticId: "TA0009", tactic: "Collection",
    techniqueId: "T1560", technique: "Archive Collected Data",
    description: "Adversaries archive collected data to compress and encrypt files before exfiltration, making detection and forensic analysis harder.",
    platforms: ["Windows", "Linux", "macOS"],
    exampleTools: ["7-Zip", "WinRAR", "tar", "zip"],
  },
  {
    tacticId: "TA0009", tactic: "Collection",
    techniqueId: "T1056", technique: "Input Capture",
    subTechniqueId: "T1056.001", subTechnique: "Keylogging",
    description: "Adversaries capture keystrokes to collect credentials, sensitive information, and user activity.",
    platforms: ["Windows", "Linux", "macOS"],
    exampleTools: ["Prynt Stealer", "Agent Tesla", "keylogger implants"],
  },
  {
    tacticId: "TA0009", tactic: "Collection",
    techniqueId: "T1074", technique: "Data Staged",
    description: "Adversaries stage collected data in a central location before exfiltration to reduce the number of outbound connections needed.",
    platforms: ["Windows", "Linux", "macOS"],
    exampleTools: ["zip", "rar", "custom staging scripts"],
  },

  // ── Command and Control (TA0011) ──────────────────────────────────────────
  {
    tacticId: "TA0011", tactic: "Command and Control",
    techniqueId: "T1071", technique: "Application Layer Protocol",
    description: "Adversaries communicate using application layer protocols (HTTP/S, DNS, SMTP) to blend C2 traffic with legitimate network traffic.",
    platforms: ["Windows", "Linux", "macOS"],
    exampleTools: ["Cobalt Strike HTTP/S beacon", "Sliver", "Merlin"],
  },
  {
    tacticId: "TA0011", tactic: "Command and Control",
    techniqueId: "T1071", technique: "Application Layer Protocol",
    subTechniqueId: "T1071.004", subTechnique: "DNS",
    description: "Adversaries use DNS queries and responses to encode C2 communications, bypassing network controls that allow DNS traffic.",
    platforms: ["Windows", "Linux", "macOS"],
    exampleTools: ["dnscat2", "Iodine", "DNScat"],
  },
  {
    tacticId: "TA0011", tactic: "Command and Control",
    techniqueId: "T1572", technique: "Protocol Tunneling",
    description: "Adversaries tunnel C2 traffic inside legitimate protocols to evade network monitoring. Common tunnels: DNS, HTTP, ICMP, SSH.",
    platforms: ["Windows", "Linux", "macOS"],
    exampleTools: ["chisel", "ngrok", "ptunnel"],
  },
  {
    tacticId: "TA0011", tactic: "Command and Control",
    techniqueId: "T1573", technique: "Encrypted Channel",
    description: "Adversaries encrypt C2 communications to prevent traffic inspection. Uses TLS, custom symmetric encryption, or asymmetric keys.",
    platforms: ["Windows", "Linux", "macOS"],
    exampleTools: ["Cobalt Strike", "Empire", "Brute Ratel C4"],
  },
  {
    tacticId: "TA0011", tactic: "Command and Control",
    techniqueId: "T1219", technique: "Remote Access Software",
    description: "Adversaries use legitimate remote access tools as C2 channels to blend in with authorized remote management activity.",
    platforms: ["Windows", "Linux", "macOS"],
    exampleTools: ["AnyDesk", "TeamViewer", "ConnectWise Control", "FleetDeck"],
  },

  // ── Exfiltration (TA0010) ─────────────────────────────────────────────────
  {
    tacticId: "TA0010", tactic: "Exfiltration",
    techniqueId: "T1041", technique: "Exfiltration Over C2 Channel",
    description: "Adversaries exfiltrate data over the same C2 channel used for control, reducing the number of external network connections.",
    platforms: ["Windows", "Linux", "macOS"],
    exampleTools: ["Cobalt Strike", "Metasploit", "custom implants"],
  },
  {
    tacticId: "TA0010", tactic: "Exfiltration",
    techniqueId: "T1048", technique: "Exfiltration Over Alternative Protocol",
    description: "Adversaries exfiltrate data over a different protocol than the C2 channel, such as FTP, SFTP, email, or DNS.",
    platforms: ["Windows", "Linux", "macOS"],
    exampleTools: ["ftp.exe", "curl", "Invoke-WebRequest"],
  },
  {
    tacticId: "TA0010", tactic: "Exfiltration",
    techniqueId: "T1537", technique: "Transfer Data to Cloud Account",
    description: "Adversaries exfiltrate data to cloud storage services they control, blending traffic with normal cloud service usage.",
    platforms: ["Windows", "Linux", "macOS", "IaaS"],
    exampleTools: ["rclone", "aws s3 cp", "OneDrive", "Mega.nz"],
  },

  // ── Impact (TA0040) ───────────────────────────────────────────────────────
  {
    tacticId: "TA0040", tactic: "Impact",
    techniqueId: "T1486", technique: "Data Encrypted for Impact",
    description: "Adversaries encrypt data on target systems to render it inaccessible and demand ransom for decryption keys. Classic ransomware behavior.",
    platforms: ["Windows", "Linux", "macOS", "IaaS"],
    exampleTools: ["LockBit", "BlackCat/ALPHV", "Conti", "REvil"],
  },
  {
    tacticId: "TA0040", tactic: "Impact",
    techniqueId: "T1490", technique: "Inhibit System Recovery",
    description: "Adversaries delete or disable recovery mechanisms to prevent restoration after ransomware deployment. Targets shadow copies, backups, and boot repair.",
    platforms: ["Windows", "Linux", "macOS"],
    exampleTools: ["vssadmin", "wbadmin", "bcdedit.exe"],
  },
  {
    tacticId: "TA0040", tactic: "Impact",
    techniqueId: "T1489", technique: "Service Stop",
    description: "Adversaries stop security-relevant services such as antivirus, backup agents, and databases to facilitate their goals.",
    platforms: ["Windows", "Linux", "macOS"],
    exampleTools: ["net stop", "sc.exe", "taskkill.exe"],
  },
  {
    tacticId: "TA0040", tactic: "Impact",
    techniqueId: "T1498", technique: "Network Denial of Service",
    description: "Adversaries perform denial of service attacks to degrade or block availability of target services using volumetric, protocol, or application-layer attacks.",
    platforms: ["Windows", "Linux", "macOS", "Network"],
    exampleTools: ["LOIC", "HOIC", "hping3", "botnets"],
  },

  // ── Resource Development (TA0042) ─────────────────────────────────────────
  {
    tacticId: "TA0042", tactic: "Resource Development",
    techniqueId: "T1583", technique: "Acquire Infrastructure",
    description: "Adversaries buy, lease, or rent infrastructure to support C2, phishing, and staging. Includes VPS hosting, domains, and IP addresses.",
    platforms: ["PRE"],
    exampleTools: ["domain registrars", "cloud VPS", "bulletproof hosting"],
  },
  {
    tacticId: "TA0042", tactic: "Resource Development",
    techniqueId: "T1588", technique: "Obtain Capabilities",
    subTechniqueId: "T1588.002", subTechnique: "Tool",
    description: "Adversaries obtain offensive security tools from public repositories, underground markets, or by developing them in-house.",
    platforms: ["PRE"],
    exampleTools: ["GitHub", "underground forums", "commercial implant kits"],
  },

  // ── Reconnaissance (TA0043) ───────────────────────────────────────────────
  {
    tacticId: "TA0043", tactic: "Reconnaissance",
    techniqueId: "T1595", technique: "Active Scanning",
    description: "Adversaries perform active reconnaissance by scanning networks and systems to gather information about targets before an attack.",
    platforms: ["PRE"],
    exampleTools: ["Nmap", "Shodan", "Masscan", "ZMap"],
  },
  {
    tacticId: "TA0043", tactic: "Reconnaissance",
    techniqueId: "T1591", technique: "Gather Victim Org Information",
    description: "Adversaries gather organizational information such as employee details, business relationships, and infrastructure using OSINT techniques.",
    platforms: ["PRE"],
    exampleTools: ["LinkedIn", "Hunter.io", "Maltego", "theHarvester"],
  },

  // ── Containers / Cloud additions ──────────────────────────────────────────
  {
    tacticId: "TA0004", tactic: "Privilege Escalation",
    techniqueId: "T1611", technique: "Escape to Host",
    description: "Adversaries escape container environments to gain access to the underlying host system, breaking isolation boundaries.",
    platforms: ["Containers", "Linux"],
    exampleTools: ["CDK", "deepce", "kubectl exec"],
  },
  {
    tacticId: "TA0007", tactic: "Discovery",
    techniqueId: "T1619", technique: "Cloud Storage Object Discovery",
    description: "Adversaries enumerate objects stored in cloud storage buckets to identify sensitive data for exfiltration.",
    platforms: ["AWS", "Azure", "GCP"],
    exampleTools: ["aws s3 ls", "gsutil", "AzureHound"],
  },
  {
    tacticId: "TA0006", tactic: "Credential Access",
    techniqueId: "T1552", technique: "Unsecured Credentials",
    subTechniqueId: "T1552.001", subTechnique: "Credentials In Files",
    description: "Adversaries search for credentials stored in plaintext files such as configuration files, scripts, and log files.",
    platforms: ["Windows", "Linux", "macOS", "Containers"],
    exampleTools: ["grep", "findstr", "PowerShell Select-String"],
  },
];

// ---------------------------------------------------------------------------
// Seeder
// ---------------------------------------------------------------------------

async function seed(): Promise<void> {
  const BATCH_SIZE = 20; // Jina API batch limit
  let inserted = 0;
  let skipped  = 0;

  console.log(`\n🔧 Seeding ${TECHNIQUES.length} MITRE ATT&CK techniques...\n`);

  // Check how many are already seeded
  const existing = await pool.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM mitre_techniques"
  );
  const alreadySeeded = parseInt(existing.rows[0]?.count ?? "0", 10);
  if (alreadySeeded >= TECHNIQUES.length) {
    console.log(`✅ Already seeded (${alreadySeeded} rows). Run with --force to re-seed.\n`);
    await pool.end();
    return;
  }

  // Process in batches
  for (let i = 0; i < TECHNIQUES.length; i += BATCH_SIZE) {
    const batch = TECHNIQUES.slice(i, i + BATCH_SIZE);

    // Build text to embed for each technique
    const texts = batch.map(t =>
      `${t.tactic} ${t.technique}${t.subTechnique ? " " + t.subTechnique : ""}: ${t.description}. Platforms: ${t.platforms.join(", ")}. Example tools: ${t.exampleTools.join(", ")}.`
    );

    console.log(`  Embedding batch ${Math.floor(i / BATCH_SIZE) + 1} (techniques ${i + 1}–${Math.min(i + BATCH_SIZE, TECHNIQUES.length)})...`);
    const embeddings = await embedBatch(texts);

    for (let j = 0; j < batch.length; j++) {
      const t   = batch[j];
      const vec = embeddings[j];
      if (!t || !vec) continue;

      const vecLiteral = `[${vec.join(",")}]`;

      await pool.query(
        `INSERT INTO mitre_techniques (
           tactic_id, tactic, technique_id, technique,
           sub_technique_id, sub_technique, description,
           platforms, example_tools, embedding
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::vector)
         ON CONFLICT DO NOTHING`,
        [
          t.tacticId,
          t.tactic,
          t.techniqueId,
          t.technique,
          t.subTechniqueId ?? null,
          t.subTechnique   ?? null,
          t.description,
          t.platforms,
          t.exampleTools,
          vecLiteral,
        ]
      );
      inserted++;
    }

    // Rate limit: be nice to Jina free tier
    if (i + BATCH_SIZE < TECHNIQUES.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.log(`\n✅ Seeding complete: ${inserted} inserted, ${skipped} skipped\n`);
  await pool.end();
}

seed().catch(err => {
  console.error("Seed failed:", err);
  process.exit(1);
});
