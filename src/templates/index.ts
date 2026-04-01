import { ConfigurationState } from '../types';

import { windowsSecurityBaseline } from './windowsSecurityBaseline';
import { windowsServiceMonitoring } from './windowsServiceMonitoring';
import { windowsAuditPolicy } from './windowsAuditPolicy';
import { windowsNetworkSecurity } from './windowsNetworkSecurity';
import { linuxSshHardening } from './linuxSshHardening';
import { linuxFilePermissions } from './linuxFilePermissions';
import { linuxScriptBasedAudit } from './linuxScriptBasedAudit';
import { linuxScriptRemediation } from './linuxScriptRemediation';
import { linuxUserSecurity } from './linuxUserSecurity';

export interface TemplateInfo {
  name: string;
  description: string;
  platform: 'Windows' | 'Linux';
  resourceCount: number;
  config: ConfigurationState;
}

export const templates: TemplateInfo[] = [
  {
    name: 'Windows Security Baseline (CIS)',
    description: 'CIS-aligned registry checks: TLS hardening, Defender, Firewall, WDigest, audit logging',
    platform: 'Windows',
    resourceCount: windowsSecurityBaseline.resources.length,
    config: windowsSecurityBaseline,
  },
  {
    name: 'Windows Audit Policy',
    description: 'CIS-aligned audit policy: logon, account management, policy changes, system events',
    platform: 'Windows',
    resourceCount: windowsAuditPolicy.resources.length,
    config: windowsAuditPolicy,
  },
  {
    name: 'Windows Network Security',
    description: 'Firewall rules: allow HTTPS, block RDP/SMB/WinRM on public, ensure firewall service',
    platform: 'Windows',
    resourceCount: windowsNetworkSecurity.resources.length,
    config: windowsNetworkSecurity,
  },
  {
    name: 'Windows Service Monitoring',
    description: 'Ensure W32Time, Windows Defender, and Windows Firewall services are running',
    platform: 'Windows',
    resourceCount: windowsServiceMonitoring.resources.length,
    config: windowsServiceMonitoring,
  },
  {
    name: 'Linux SSH Hardening',
    description: 'Disable root login, disable password auth, limit auth tries, secure sshd_config permissions',
    platform: 'Linux',
    resourceCount: linuxSshHardening.resources.length,
    config: linuxSshHardening,
  },
  {
    name: 'Linux Script-Based Audit (nxScript)',
    description: 'Custom compliance checks using nxScript — firewall, world-writable files, NTP, empty passwords',
    platform: 'Linux',
    resourceCount: linuxScriptBasedAudit.resources.length,
    config: linuxScriptBasedAudit,
  },
  {
    name: 'Linux User & Group Security',
    description: 'Root group, /etc/passwd + /etc/shadow permissions, login.defs password policy, UID 0 audit',
    platform: 'Linux',
    resourceCount: linuxUserSecurity.resources.length,
    config: linuxUserSecurity,
  },
  {
    name: 'Linux Sysctl Remediation (nxScript)',
    description: 'Audit AND fix kernel sysctl parameters — IP forwarding, SYN cookies, ICMP redirects, reverse path filtering, core dumps',
    platform: 'Linux',
    resourceCount: linuxScriptRemediation.resources.length,
    config: linuxScriptRemediation,
  },
  {
    name: 'Linux File Permissions',
    description: 'Audit /etc/passwd, /etc/shadow, /etc/group, /etc/gshadow permissions',
    platform: 'Linux',
    resourceCount: linuxFilePermissions.resources.length,
    config: linuxFilePermissions,
  },
];

export {
  windowsSecurityBaseline, windowsServiceMonitoring, windowsAuditPolicy, windowsNetworkSecurity,
  linuxSshHardening, linuxFilePermissions, linuxScriptBasedAudit, linuxScriptRemediation, linuxUserSecurity,
};
