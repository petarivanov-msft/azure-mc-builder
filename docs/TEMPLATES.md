# Template Gallery

A visual overview of all pre-built templates included in the Azure Machine Configuration Builder.

## Windows Templates

### Windows Security Baseline (CIS)
**Mode:** Audit · **Resources:** 14 · **Module:** PSDscResources

CIS Level 1 aligned registry checks covering the most impactful Windows security settings.

| Resource | Instance | What It Checks |
|----------|----------|----------------|
| Registry | DisableTLS10 | TLS 1.0 disabled on server |
| Registry | EnableTLS12 | TLS 1.2 enabled on server |
| Registry | DisableWDigest | WDigest credential caching disabled |
| Registry | EnablePUADetection | Defender PUA protection enabled |
| Registry | DontDisableDefender | Defender anti-spyware not disabled |
| Registry | EnableRealtimeProtection | Defender real-time monitoring active |
| Registry | EnableScriptScanning | Defender script scanning active |
| Registry | SafeDllSearchMode | Safe DLL search mode enabled |
| Registry | DomainFirewallOn | Domain profile firewall enabled |
| Registry | PrivateFirewallOn | Private profile firewall enabled |
| Registry | PublicFirewallOn | Public profile firewall enabled |
| Registry | DisableAutorun | Autorun disabled |
| Registry | AuditProcessCreation | Process creation audit enabled |
| Registry | EnableDEP | Data Execution Prevention enforced |

---

### Windows Audit Policy Baseline
**Mode:** Audit · **Resources:** 8 · **Module:** AuditPolicyDsc

CIS-aligned Windows audit policy covering critical security event categories.

| Resource | Instance | What It Checks |
|----------|----------|----------------|
| AuditPolicySubcategory | AuditLogonSuccess | Logon events (success) |
| AuditPolicySubcategory | AuditLogonFailure | Logon events (failure) |
| AuditPolicySubcategory | AuditAccountManagement | Account management changes |
| AuditPolicySubcategory | AuditPolicyChange | Policy change events |
| AuditPolicySubcategory | AuditSystemIntegrity | System integrity events |
| AuditPolicySubcategory | AuditPrivilegeUse | Privilege use events |
| AuditPolicySubcategory | AuditObjectAccess | Object access events |
| AuditPolicyOption | CrashOnAuditFail | CrashOnAuditFail disabled |

---

### Windows Network Security
**Mode:** Audit · **Resources:** 5 · **Modules:** NetworkingDsc, PSDscResources

Firewall rules to restrict dangerous protocols on public-facing interfaces.

| Resource | Instance | What It Checks |
|----------|----------|----------------|
| Firewall | AllowHTTPS | HTTPS (443) allowed inbound |
| Firewall | BlockRDPPublic | RDP (3389) blocked on public profile |
| Firewall | BlockSMB | SMB (445) blocked on public profile |
| Firewall | BlockWinRM | WinRM (5985-5986) blocked on public profile |
| Service | FirewallService | Windows Firewall service running |

---

### Windows Service Monitoring
**Mode:** Audit · **Resources:** 3 · **Module:** PSDscResources

Ensures critical Windows services are running.

| Resource | Instance | What It Checks |
|----------|----------|----------------|
| Service | W32Time | Windows Time service running (auto start) |
| Service | WinDefend | Windows Defender service running |
| Service | MpsSvc | Windows Firewall service running |

---

## Linux Templates

### Linux SSH Hardening
**Mode:** Audit · **Resources:** 5 · **Modules:** nxtools

Hardens SSH configuration based on CIS and NIST guidelines.

| Resource | Instance | What It Checks |
|----------|----------|----------------|
| nxFile | SSHConfigPerms | `/etc/ssh/sshd_config` permissions (0600, root:root) |
| nxFileLine | DisableRootLogin | `PermitRootLogin no` present in sshd_config |
| nxFileLine | DisablePasswordAuth | `PasswordAuthentication no` present |
| nxFileLine | LimitAuthTries | `MaxAuthTries 4` present |
| nxService | SSHD | sshd service running and enabled |

---

### Linux File Permissions
**Mode:** Audit · **Resources:** 4 · **Module:** nxtools

Audits permissions on critical system files.

| Resource | Instance | What It Checks |
|----------|----------|----------------|
| nxFile | EtcPasswd | `/etc/passwd` — mode 0644, root:root |
| nxFile | EtcShadow | `/etc/shadow` — mode 0640, root:shadow |
| nxFile | EtcGroup | `/etc/group` — mode 0644, root:root |
| nxFile | EtcGshadow | `/etc/gshadow` — mode 0640, root:shadow |

---

### Linux Script-Based Audit (nxScript)
**Mode:** Audit · **Resources:** 5 · **Module:** nxtools

Custom compliance checks using `nxScript` with the `[Reason]` class pattern for rich compliance reporting.

| Resource | Instance | What It Checks |
|----------|----------|----------------|
| nxScript | CheckFirewallActive | UFW/iptables has active rules |
| nxScript | CheckNoWorldWritableFiles | No world-writable files in system paths |
| nxScript | CheckTimeSyncConfigured | NTP/chrony/systemd-timesyncd active |
| nxScript | CheckNoEmptyPasswords | No users with empty password fields |
| nxScript | CheckSwapDisabled | Swap is disabled (for container/K8s hosts) |

---

### Linux User & Group Security
**Mode:** Audit · **Resources:** 6 · **Module:** nxtools

User and group security checks based on CIS benchmarks.

| Resource | Instance | What It Checks |
|----------|----------|----------------|
| nxGroup | RootGroup | Root group exists with correct GID |
| nxFile | EtcPasswdPerms | `/etc/passwd` permissions |
| nxFile | EtcShadowPerms | `/etc/shadow` permissions |
| nxFileLine | PasswordMinDays | Minimum password age in `/etc/login.defs` |
| nxFileLine | PasswordMaxDays | Maximum password age in `/etc/login.defs` |
| nxScript | NoUID0Duplicates | Only root has UID 0 |

---

### Linux Sysctl Remediation (nxScript)
**Mode:** AuditAndSet · **Resources:** 5 · **Module:** nxtools

The only remediation template — audits kernel parameters AND automatically fixes drift.

| Resource | Instance | What It Checks / Remediates |
|----------|----------|-----------------------------|
| nxScript | DisableIPv4Forwarding | `net.ipv4.ip_forward = 0` |
| nxScript | EnableSYNCookies | `net.ipv4.tcp_syncookies = 1` |
| nxScript | DisableICMPRedirects | `net.ipv4.conf.all.accept_redirects = 0` |
| nxScript | EnableReversePathFiltering | `net.ipv4.conf.all.rp_filter = 1` |
| nxScript | DisableCoreDumps | `fs.suid_dumpable = 0` |

> **Note:** This is the only template using `AuditAndSet` mode. The GC agent will automatically apply the correct sysctl values if they drift.

---

## Using Templates

1. Open the [builder](https://petarivanov-msft.github.io/azure-mc-builder/)
2. Click **Templates** in the top bar
3. Select a template — it loads the full configuration
4. Customise as needed (add/remove resources, change properties)
5. Click **Download ZIP** to get the deployment package

Templates are starting points. You can mix and match — load a template, then add resources from other categories.
