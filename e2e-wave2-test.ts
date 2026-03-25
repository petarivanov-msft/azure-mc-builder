import { generateMofContent, generateMofFile } from './src/generators/mofGenerator';
import { generateMetaconfigString } from './src/generators/metaconfigGenerator';
import { generatePolicyJsonString } from './src/generators/policyGenerator';
import { generatePackageScript } from './src/generators/packageScriptGenerator';
import * as fs from 'fs';

const wave2Configs = [
  // ═══ WINDOWS - More Resource Types ═══
  
  // Firewall rule audit
  {
    configName: "WinFirewallAudit",
    platform: "Windows",
    mode: "Audit",
    version: "1.0.0",
    description: "Audit Windows Firewall - RDP rule",
    resources: [{
      id: "r1", schemaName: "Firewall", instanceName: "RDPRule",
      properties: { Name: "RemoteDesktop-UserMode-In-TCP", Ensure: "Present", Enabled: "True", Direction: "Inbound", Action: "Allow", Protocol: "TCP", LocalPort: "3389" }
    }]
  },

  // ScheduledTask audit
  {
    configName: "WinScheduledTask",
    platform: "Windows",
    mode: "Audit",
    version: "1.0.0",
    description: "Audit Windows Update scheduled task",
    resources: [{
      id: "r1", schemaName: "ScheduledTask", instanceName: "WUTask",
      properties: { TaskName: "Scheduled Start", TaskPath: "\\Microsoft\\Windows\\WindowsUpdate\\", Ensure: "Present", Enable: true }
    }]
  },

  // PowerPlan
  {
    configName: "WinPowerPlan",
    platform: "Windows",
    mode: "Audit",
    version: "1.0.0",
    description: "Audit power plan is Balanced",
    resources: [{
      id: "r1", schemaName: "PowerPlan", instanceName: "BalancedPlan",
      properties: { IsSingleInstance: "Yes", Name: "Balanced" }
    }]
  },

  // UserRightsAssignment
  {
    configName: "WinUserRights",
    platform: "Windows",
    mode: "Audit",
    version: "1.0.0",
    description: "Audit Remote Desktop logon rights",
    resources: [{
      id: "r1", schemaName: "UserRightsAssignment", instanceName: "RDPLogon",
      properties: { Policy: "Allow_log_on_through_Remote_Desktop_Services", Identity: "Administrators" }
    }]
  },

  // SecurityOption audit
  {
    configName: "WinSecurityOption",
    platform: "Windows",
    mode: "Audit",
    version: "1.0.0",
    description: "Audit security options - rename admin, disable guest",
    resources: [{
      id: "r1", schemaName: "SecurityOption", instanceName: "SecOpts",
      properties: {
        Name: "SecurityOptions",
        Accounts_Guest_account_status: "Disabled",
        Interactive_logon_Do_not_display_last_user_name: "Enabled",
        Network_security_LAN_Manager_authentication_level: "Send NTLMv2 response only. Refuse LM & NTLM"
      }
    }]
  },

  // AuditPolicyOption
  {
    configName: "WinAuditOption",
    platform: "Windows",
    mode: "Audit",
    version: "1.0.0",
    description: "Audit CrashOnAuditFail option",
    resources: [{
      id: "r1", schemaName: "AuditPolicyOption", instanceName: "CrashOnFail",
      properties: { Name: "CrashOnAuditFail", Value: "Disabled" }
    }]
  },

  // WindowsOptionalFeature
  {
    configName: "WinOptionalFeature",
    platform: "Windows",
    mode: "Audit",
    version: "1.0.0",
    description: "Audit SMB1 protocol is disabled",
    resources: [{
      id: "r1", schemaName: "WindowsOptionalFeature", instanceName: "SMB1Disabled",
      properties: { Name: "SMB1Protocol", Ensure: "Disable" }
    }]
  },

  // WindowsPackageCab
  {
    configName: "WinPackageCab",
    platform: "Windows",
    mode: "Audit",
    version: "1.0.0",
    description: "Audit RSAT package",
    resources: [{
      id: "r1", schemaName: "WindowsPackageCab", instanceName: "RSATCheck",
      properties: { Name: "Rsat.ActiveDirectory.DS-LDS.Tools~~~~0.0.1.0", SourcePath: "C:\\Windows\\servicing\\Packages", Ensure: "Present" }
    }]
  },

  // ═══ WINDOWS - Complex Multi-Module ═══
  
  // Security hardening baseline — 5 resources across 3 modules
  {
    configName: "WinSecurityBaseline",
    platform: "Windows",
    mode: "Audit",
    version: "1.0.0",
    description: "Security hardening baseline: registry + password + audit + firewall",
    resources: [
      {
        id: "r1", schemaName: "Registry", instanceName: "TLS12Server",
        properties: { Key: "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\SecurityProviders\\SCHANNEL\\Protocols\\TLS 1.2\\Server", ValueName: "Enabled", ValueData: "1", ValueType: "Dword", Ensure: "Present" }
      },
      {
        id: "r2", schemaName: "Registry", instanceName: "TLS10Disabled",
        properties: { Key: "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\SecurityProviders\\SCHANNEL\\Protocols\\TLS 1.0\\Client", ValueName: "Enabled", ValueData: "0", ValueType: "Dword", Ensure: "Present" }
      },
      {
        id: "r3", schemaName: "AccountPolicy", instanceName: "StrongPasswords",
        properties: { Name: "StrongPW", Minimum_Password_Length: "14", Password_must_meet_complexity_requirements: "Enabled", Account_lockout_threshold: "5", Account_lockout_duration: "30" }
      },
      {
        id: "r4", schemaName: "AuditPolicySubcategory", instanceName: "LogonEvents",
        properties: { Name: "Logon", AuditFlag: "Success", Ensure: "Present" }
      },
      {
        id: "r5", schemaName: "Firewall", instanceName: "BlockTelnet",
        properties: { Name: "BlockTelnet", Ensure: "Present", Enabled: "True", Direction: "Inbound", Action: "Block", Protocol: "TCP", LocalPort: "23" }
      }
    ]
  },

  // ═══ WINDOWS - Remediation configs ═══
  
  // Registry remediation
  {
    configName: "WinRegistryRemediate",
    platform: "Windows",
    mode: "AuditAndSet",
    version: "1.0.0",
    description: "Enforce NTP sync registry key",
    resources: [{
      id: "r1", schemaName: "Registry", instanceName: "NTPSync",
      properties: { Key: "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\W32Time\\Parameters", ValueName: "Type", ValueData: "NTP", ValueType: "String", Ensure: "Present" }
    }]
  },

  // Service remediation
  {
    configName: "WinServiceRemediate",
    platform: "Windows",
    mode: "AuditAndSet",
    version: "1.0.0",
    description: "Ensure Windows Update service is running",
    resources: [{
      id: "r1", schemaName: "Service", instanceName: "WUService",
      properties: { Name: "wuauserv", State: "Running", StartupType: "Automatic", Ensure: "Present" }
    }]
  },

  // ═══ LINUX - More configs ═══
  
  // nxFileContentReplace
  {
    configName: "LinuxFileContentReplace",
    platform: "Linux",
    mode: "Audit",
    version: "1.0.0",
    description: "Audit sshd PasswordAuthentication disabled",
    resources: [{
      id: "r1", schemaName: "nxFileContentReplace", instanceName: "SshdPasswordAuth",
      properties: { FilePath: "/etc/ssh/sshd_config", EnsureExpectedPattern: "PasswordAuthentication no", SearchPattern: "^#?PasswordAuthentication.*", ReplacementString: "PasswordAuthentication no" }
    }]
  },

  // Linux security baseline — multi-resource
  {
    configName: "LinuxSecurityBaseline",
    platform: "Linux",
    mode: "Audit",
    version: "1.0.0",
    description: "Linux security baseline: SSH + file perms + users + services",
    resources: [
      {
        id: "r1", schemaName: "nxFile", instanceName: "SshdConfigPerms",
        properties: { DestinationPath: "/etc/ssh/sshd_config", Ensure: "Present", Type: "File", Mode: "0600", Owner: "root", Group: "root" }
      },
      {
        id: "r2", schemaName: "nxFile", instanceName: "EtcShadowPerms",
        properties: { DestinationPath: "/etc/shadow", Ensure: "Present", Type: "File", Mode: "0640", Owner: "root", Group: "shadow" }
      },
      {
        id: "r3", schemaName: "nxFileLine", instanceName: "NoRootSSH",
        properties: { FilePath: "/etc/ssh/sshd_config", ContainsLine: "PermitRootLogin no", DoesNotContainPattern: "^PermitRootLogin yes" }
      },
      {
        id: "r4", schemaName: "nxService", instanceName: "SshdRunning",
        properties: { Name: "sshd", State: "Running", Controller: "systemd" }
      },
      {
        id: "r5", schemaName: "nxUser", instanceName: "NoGuestUser",
        properties: { UserName: "guest", Ensure: "Absent" }
      },
      {
        id: "r6", schemaName: "nxPackage", instanceName: "Ufw",
        properties: { Name: "ufw", Ensure: "Present" }
      }
    ]
  },

  // Linux remediation — file permissions
  {
    configName: "LinuxPermRemediate",
    platform: "Linux",
    mode: "AuditAndSet",
    version: "1.0.0",
    description: "Enforce correct /etc/passwd permissions",
    resources: [{
      id: "r1", schemaName: "nxFile", instanceName: "PasswdPerms",
      properties: { DestinationPath: "/etc/passwd", Ensure: "Present", Type: "File", Mode: "0644", Owner: "root", Group: "root" }
    }]
  },

  // Linux — nxFile with content (file creation)
  {
    configName: "LinuxFileContent",
    platform: "Linux",
    mode: "AuditAndSet",
    version: "1.0.0",
    description: "Ensure MOTD file exists with content",
    resources: [{
      id: "r1", schemaName: "nxFile", instanceName: "MOTDFile",
      properties: { DestinationPath: "/etc/motd", Ensure: "Present", Type: "File", Contents: "Managed by Azure Machine Configuration", Owner: "root", Group: "root", Mode: "0644" }
    }]
  },

  // Linux max resources stress test
  {
    configName: "LinuxMaxResources",
    platform: "Linux",
    mode: "Audit",
    version: "1.0.0",
    description: "Stress test with 8 resources across all Linux types",
    resources: [
      { id: "r1", schemaName: "nxFile", instanceName: "EtcHostname", properties: { DestinationPath: "/etc/hostname", Ensure: "Present", Type: "File" } },
      { id: "r2", schemaName: "nxFile", instanceName: "EtcResolv", properties: { DestinationPath: "/etc/resolv.conf", Ensure: "Present", Type: "File" } },
      { id: "r3", schemaName: "nxUser", instanceName: "Root", properties: { UserName: "root", Ensure: "Present" } },
      { id: "r4", schemaName: "nxUser", instanceName: "AzUser", properties: { UserName: "azureuser", Ensure: "Present" } },
      { id: "r5", schemaName: "nxGroup", instanceName: "Sudo", properties: { GroupName: "sudo", Ensure: "Present" } },
      { id: "r6", schemaName: "nxService", instanceName: "Cron", properties: { Name: "cron", State: "Running", Controller: "systemd" } },
      { id: "r7", schemaName: "nxPackage", instanceName: "Wget", properties: { Name: "wget", Ensure: "Present" } },
      { id: "r8", schemaName: "nxFileLine", instanceName: "DNSNameserver", properties: { FilePath: "/etc/resolv.conf", ContainsLine: "nameserver", CaseSensitive: true } },
    ]
  },
];

const results: Array<{name: string; platform: string; mode: string; resources: number; mofSize: number; policyEffect: string; error?: string}> = [];

for (const config of wave2Configs) {
  const outDir = '/tmp/e2e-tests/' + config.configName;
  fs.mkdirSync(outDir, { recursive: true });
  try {
    const mofFile = generateMofFile(config as any);
    const metaconfig = generateMetaconfigString(config as any);
    const policy = generatePolicyJsonString(config as any);
    const ps1 = generatePackageScript(config as any);
    fs.writeFileSync(outDir + '/' + config.configName + '.mof', Buffer.from(mofFile));
    fs.writeFileSync(outDir + '/' + config.configName + '.metaconfig.json', metaconfig);
    fs.writeFileSync(outDir + '/policy.json', policy);
    fs.writeFileSync(outDir + '/package.ps1', ps1);
    const policyObj = JSON.parse(policy);
    results.push({ name: config.configName, platform: config.platform, mode: config.mode, resources: config.resources.length, mofSize: mofFile.length, policyEffect: policyObj.properties.policyRule.then.effect });
  } catch (e: any) {
    results.push({ name: config.configName, platform: config.platform, mode: config.mode, resources: config.resources.length, mofSize: 0, policyEffect: 'ERROR', error: e.message });
  }
}

console.log('Config'.padEnd(28) + 'Plat'.padEnd(9) + 'Mode'.padEnd(15) + 'Res'.padEnd(5) + 'MOF'.padEnd(7) + 'Effect'.padEnd(20) + 'Status');
console.log('─'.repeat(95));
for (const r of results) {
  const s = r.error ? '❌ ' + r.error.substring(0, 40) : '✅';
  console.log(r.name.padEnd(28) + r.platform.padEnd(9) + r.mode.padEnd(15) + String(r.resources).padEnd(5) + String(r.mofSize).padEnd(7) + r.policyEffect.padEnd(20) + s);
}
console.log('\nWave 2: ' + results.length + ' | OK: ' + results.filter(r => !r.error).length + ' | Failed: ' + results.filter(r => r.error).length);
