import { generateMofContent, generateMofFile } from './src/generators/mofGenerator';
import { generateMetaconfigString } from './src/generators/metaconfigGenerator';
import { generatePolicyJsonString } from './src/generators/policyGenerator';
import { generatePackageScript } from './src/generators/packageScriptGenerator';
import * as fs from 'fs';

interface TestConfig {
  configName: string;
  platform: string;
  mode: string;
  version: string;
  description: string;
  resources: Array<{
    id: string;
    schemaName: string;
    instanceName: string;
    properties: Record<string, unknown>;
  }>;
}

const testConfigs: TestConfig[] = [
  // ═══ WINDOWS TESTS ═══

  // 3. WindowsFeature Audit
  {
    configName: "WinFeatureAudit",
    platform: "Windows",
    mode: "Audit",
    version: "1.0.0",
    description: "Audit whether Web-Server (IIS) feature is installed",
    resources: [{
      id: "r1", schemaName: "WindowsFeature", instanceName: "IISCheck",
      properties: { Name: "Web-Server", Ensure: "Present" }
    }]
  },

  // 4. Service Audit
  {
    configName: "WinServiceAudit",
    platform: "Windows",
    mode: "Audit",
    version: "1.0.0",
    description: "Audit WinRM service is running",
    resources: [{
      id: "r1", schemaName: "Service", instanceName: "WinRMRunning",
      properties: { Name: "WinRM", State: "Running", Ensure: "Present" }
    }]
  },

  // 5. User Audit
  {
    configName: "WinUserAudit",
    platform: "Windows",
    mode: "Audit",
    version: "1.0.0",
    description: "Audit local admin account exists",
    resources: [{
      id: "r1", schemaName: "User", instanceName: "AdminExists",
      properties: { UserName: "Administrator", Ensure: "Present" }
    }]
  },

  // 6. Script resource
  {
    configName: "WinScriptAudit",
    platform: "Windows",
    mode: "Audit",
    version: "1.0.0",
    description: "Custom script to check PowerShell version",
    resources: [{
      id: "r1", schemaName: "Script", instanceName: "PSVersionCheck",
      properties: {
        GetScript: "@{ Result = $PSVersionTable.PSVersion.ToString() }",
        TestScript: "$PSVersionTable.PSVersion.Major -ge 5",
        SetScript: "Write-Verbose 'No action needed'"
      }
    }]
  },

  // 7. Multi-resource config
  {
    configName: "WinMultiResource",
    platform: "Windows",
    mode: "Audit",
    version: "1.0.0",
    description: "Multi-resource: Registry + Service + WindowsFeature",
    resources: [
      {
        id: "r1", schemaName: "Registry", instanceName: "TLSCheck",
        properties: {
          Key: "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\SecurityProviders\\SCHANNEL\\Protocols\\TLS 1.2\\Client",
          ValueName: "Enabled", ValueData: "1", ValueType: "Dword", Ensure: "Present"
        }
      },
      {
        id: "r2", schemaName: "Service", instanceName: "WinRMCheck",
        properties: { Name: "WinRM", State: "Running", Ensure: "Present" }
      },
      {
        id: "r3", schemaName: "WindowsFeature", instanceName: "RemoteMgmt",
        properties: { Name: "Windows-Server-Backup", Ensure: "Present" }
      }
    ]
  },

  // 8. Environment variable
  {
    configName: "WinEnvAudit",
    platform: "Windows",
    mode: "Audit",
    version: "1.0.0",
    description: "Audit TEMP environment variable",
    resources: [{
      id: "r1", schemaName: "Environment", instanceName: "TempVar",
      properties: { Name: "TEMP", Ensure: "Present", Path: false }
    }]
  },

  // 9. WindowsProcess
  {
    configName: "WinProcessAudit",
    platform: "Windows",
    mode: "Audit",
    version: "1.0.0",
    description: "Audit svchost process running",
    resources: [{
      id: "r1", schemaName: "WindowsProcess", instanceName: "SvchostRunning",
      properties: { Path: "C:\\Windows\\System32\\svchost.exe", Arguments: "-k netsvcs", Ensure: "Present" }
    }]
  },

  // 10. SecurityPolicyDsc - AccountPolicy
  {
    configName: "WinAccountPolicy",
    platform: "Windows",
    mode: "Audit",
    version: "1.0.0",
    description: "Audit password policy settings",
    resources: [{
      id: "r1", schemaName: "AccountPolicy", instanceName: "PasswordPolicy",
      properties: {
        Name: "PasswordPolicy",
        Minimum_Password_Length: "8",
        Password_must_meet_complexity_requirements: "Enabled",
        Enforce_password_history: "24"
      }
    }]
  },

  // 11. AuditPolicyDsc
  {
    configName: "WinAuditPolicy",
    platform: "Windows",
    mode: "Audit",
    version: "1.0.0",
    description: "Audit logon events audit policy",
    resources: [{
      id: "r1", schemaName: "AuditPolicySubcategory", instanceName: "LogonAudit",
      properties: { Name: "Logon", AuditFlag: "Success", Ensure: "Present" }
    }]
  },

  // 12. Special chars in values
  {
    configName: "WinSpecialChars",
    platform: "Windows",
    mode: "Audit",
    version: "1.0.0",
    description: "Test special characters in registry values",
    resources: [{
      id: "r1", schemaName: "Registry", instanceName: "SpecialCharsTest",
      properties: {
        Key: "HKLM:\\SOFTWARE\\Test\\App (v2.0)",
        ValueName: "Config-Path_v2",
        ValueData: "C:\\Program Files\\My App\\config.json",
        ValueType: "String",
        Ensure: "Present"
      }
    }]
  },

  // 13. TimeZone
  {
    configName: "WinTimeZone",
    platform: "Windows",
    mode: "Audit",
    version: "1.0.0",
    description: "Audit timezone is UTC",
    resources: [{
      id: "r1", schemaName: "TimeZone", instanceName: "UTCCheck",
      properties: { IsSingleInstance: "Yes", TimeZone: "UTC" }
    }]
  },

  // ═══ LINUX TESTS ═══

  // 14. nxFile Audit
  {
    configName: "LinuxFileAudit",
    platform: "Linux",
    mode: "Audit",
    version: "1.0.0",
    description: "Audit sshd_config exists",
    resources: [{
      id: "r1", schemaName: "nxFile", instanceName: "SshdConfig",
      properties: { DestinationPath: "/etc/ssh/sshd_config", Ensure: "Present", Type: "File" }
    }]
  },

  // 15. nxFile AuditAndSet (permissions)
  {
    configName: "LinuxFileRemediate",
    platform: "Linux",
    mode: "AuditAndSet",
    version: "1.0.0",
    description: "Enforce sshd_config permissions",
    resources: [{
      id: "r1", schemaName: "nxFile", instanceName: "SshdConfigPerms",
      properties: { DestinationPath: "/etc/ssh/sshd_config", Ensure: "Present", Type: "File", Mode: "0600", Owner: "root", Group: "root" }
    }]
  },

  // 16. nxService Audit
  {
    configName: "LinuxServiceAudit",
    platform: "Linux",
    mode: "Audit",
    version: "1.0.0",
    description: "Audit sshd service running",
    resources: [{
      id: "r1", schemaName: "nxService", instanceName: "SshdRunning",
      properties: { Name: "sshd", Enabled: true, State: "Running", Controller: "systemd" }
    }]
  },

  // 17. nxUser Audit
  {
    configName: "LinuxUserAudit",
    platform: "Linux",
    mode: "Audit",
    version: "1.0.0",
    description: "Audit azureuser exists",
    resources: [{
      id: "r1", schemaName: "nxUser", instanceName: "AzureUserExists",
      properties: { UserName: "azureuser", Ensure: "Present" }
    }]
  },

  // 18. nxGroup Audit
  {
    configName: "LinuxGroupAudit",
    platform: "Linux",
    mode: "Audit",
    version: "1.0.0",
    description: "Audit sudo group exists",
    resources: [{
      id: "r1", schemaName: "nxGroup", instanceName: "SudoGroup",
      properties: { GroupName: "sudo", Ensure: "Present" }
    }]
  },

  // 19. nxFileLine Audit
  {
    configName: "LinuxFileLineAudit",
    platform: "Linux",
    mode: "Audit",
    version: "1.0.0",
    description: "Audit sshd PermitRootLogin setting",
    resources: [{
      id: "r1", schemaName: "nxFileLine", instanceName: "SshdRootLogin",
      properties: { FilePath: "/etc/ssh/sshd_config", ContainsLine: "PermitRootLogin no", DoesNotContainPattern: "PermitRootLogin yes" }
    }]
  },

  // 20. nxPackage Audit
  {
    configName: "LinuxPackageAudit",
    platform: "Linux",
    mode: "Audit",
    version: "1.0.0",
    description: "Audit curl package installed",
    resources: [{
      id: "r1", schemaName: "nxPackage", instanceName: "CurlInstalled",
      properties: { Name: "curl", Ensure: "Present" }
    }]
  },

  // 21. nxScript
  {
    configName: "LinuxScriptAudit",
    platform: "Linux",
    mode: "Audit",
    version: "1.0.0",
    description: "Custom script to check disk space",
    resources: [{
      id: "r1", schemaName: "nxScript", instanceName: "DiskSpaceCheck",
      properties: {
        GetScript: "df -h / | tail -1",
        TestScript: "[ $(df / --output=pcent | tail -1 | tr -d ' %') -lt 90 ]",
        SetScript: "echo 'Disk space above 90%' >> /var/log/disk-alert.log"
      }
    }]
  },

  // 22. Multi-resource Linux
  {
    configName: "LinuxMultiResource",
    platform: "Linux",
    mode: "Audit",
    version: "1.0.0",
    description: "Multi-resource: File + User + Service + Package",
    resources: [
      {
        id: "r1", schemaName: "nxFile", instanceName: "EtcHostname",
        properties: { DestinationPath: "/etc/hostname", Ensure: "Present", Type: "File" }
      },
      {
        id: "r2", schemaName: "nxUser", instanceName: "RootUser",
        properties: { UserName: "root", Ensure: "Present" }
      },
      {
        id: "r3", schemaName: "nxService", instanceName: "Sshd",
        properties: { Name: "sshd", State: "Running", Controller: "systemd" }
      },
      {
        id: "r4", schemaName: "nxPackage", instanceName: "OpenSSH",
        properties: { Name: "openssh-server", Ensure: "Present" }
      }
    ]
  },

  // 23. Long resource names / max resources
  {
    configName: "WinMaxResources",
    platform: "Windows",
    mode: "Audit",
    version: "1.0.0",
    description: "Test with many resources and long names",
    resources: Array.from({length: 10}, (_, i) => ({
      id: `r${i+1}`,
      schemaName: "Registry",
      instanceName: `VeryLongResourceNameForTestingPurposes_Item${String(i+1).padStart(3,'0')}`,
      properties: {
        Key: `HKLM:\\SOFTWARE\\E2ETest\\Config${i+1}`,
        ValueName: `Setting${i+1}`,
        ValueData: `Value${i+1}`,
        ValueType: "String",
        Ensure: "Present"
      }
    }))
  },
];

// Generate all
const results: Array<{name: string; platform: string; mode: string; resources: number; mofSize: number; policyEffect: string; error?: string}> = [];

for (const config of testConfigs) {
  const outDir = `/tmp/e2e-tests/${config.configName}`;
  fs.mkdirSync(outDir, { recursive: true });

  try {
    const mofContent = generateMofContent(config as any);
    const mofFile = generateMofFile(config as any);
    const metaconfig = generateMetaconfigString(config as any);
    const policy = generatePolicyJsonString(config as any);
    const ps1 = generatePackageScript(config as any);

    fs.writeFileSync(`${outDir}/${config.configName}.mof`, Buffer.from(mofFile));
    fs.writeFileSync(`${outDir}/${config.configName}.metaconfig.json`, metaconfig);
    fs.writeFileSync(`${outDir}/policy.json`, policy);
    fs.writeFileSync(`${outDir}/package.ps1`, ps1);

    const policyObj = JSON.parse(policy);
    const effect = policyObj.properties.policyRule.then.effect;

    results.push({
      name: config.configName,
      platform: config.platform,
      mode: config.mode,
      resources: config.resources.length,
      mofSize: mofFile.length,
      policyEffect: effect
    });
  } catch (e: any) {
    results.push({
      name: config.configName,
      platform: config.platform,
      mode: config.mode,
      resources: config.resources.length,
      mofSize: 0,
      policyEffect: 'ERROR',
      error: e.message
    });
  }
}

console.log('\n═══ Generation Results ═══\n');
console.log('Config'.padEnd(25) + 'Platform'.padEnd(10) + 'Mode'.padEnd(15) + 'Res'.padEnd(5) + 'MOF'.padEnd(8) + 'Effect'.padEnd(20) + 'Status');
console.log('─'.repeat(90));
for (const r of results) {
  const status = r.error ? `❌ ${r.error}` : '✅ OK';
  console.log(
    r.name.padEnd(25) +
    r.platform.padEnd(10) +
    r.mode.padEnd(15) +
    String(r.resources).padEnd(5) +
    String(r.mofSize).padEnd(8) +
    r.policyEffect.padEnd(20) +
    status
  );
}
console.log('\nTotal: ' + results.length + ' | OK: ' + results.filter(r => !r.error).length + ' | Failed: ' + results.filter(r => r.error).length);
