#!/usr/bin/env npx tsx
/**
 * E2E Test Config Generator
 *
 * Generates MOF files + package.ps1 for every template AND synthetic
 * test scenarios (single-resource, multi-module, edge cases).
 * Output: /tmp/mc-e2e/<ConfigName>/<ConfigName>.mof + package.ps1
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { generateMofContent, GC_UNSUPPORTED_CLASSES } from '../src/generators/mofGenerator';
import { generatePackageScript } from '../src/generators/packageScriptGenerator';
import { generateMetaconfigString } from '../src/generators/metaconfigGenerator';
import { templates } from '../src/templates/index';
import { allSchemas, schemasByName } from '../src/schemas/index';
import { ConfigurationState, ResourceInstance } from '../src/types';

const OUTPUT_DIR = process.env.E2E_OUTPUT || path.join(os.tmpdir(), 'mc-e2e');

/** Build a test instance with realistic values for every property */
function buildInstance(schemaName: string, instanceName: string, overrides: Record<string, unknown> = {}): ResourceInstance {
  const schema = schemasByName[schemaName];
  if (!schema) throw new Error(`Unknown schema: ${schemaName}`);

  const props: Record<string, unknown> = {};

  for (const p of schema.properties) {
    // Use override if provided
    if (overrides[p.name] !== undefined) {
      props[p.name] = overrides[p.name];
      continue;
    }

    // Fill required properties with realistic defaults
    if (!p.required) continue;

    if (p.defaultValue !== undefined) {
      props[p.name] = p.defaultValue;
    } else if (p.enumValues && p.enumValues.length > 0) {
      props[p.name] = p.type === 'string[]' ? [p.enumValues[0]] : p.enumValues[0];
    } else if (p.placeholder) {
      props[p.name] = p.type === 'string[]' ? [p.placeholder] : p.placeholder;
    } else {
      switch (p.type) {
        case 'string': props[p.name] = `test-${p.name}`; break;
        case 'string[]': props[p.name] = [`test-${p.name}`]; break;
        case 'boolean': props[p.name] = true; break;
        case 'integer': props[p.name] = 1; break;
      }
    }
  }

  return {
    id: `${schemaName}-${instanceName}`,
    schemaName,
    instanceName,
    properties: { ...props, ...overrides },
    dependsOn: [],
  };
}

function writeConfig(configName: string, config: ConfigurationState) {
  const dir = path.join(OUTPUT_DIR, configName);
  fs.mkdirSync(dir, { recursive: true });

  // Write MOF with UTF-8 BOM
  const mofContent = generateMofContent(config);
  const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
  fs.writeFileSync(path.join(dir, `${configName}.mof`), Buffer.concat([bom, Buffer.from(mofContent)]));

  // Write package.ps1
  fs.writeFileSync(path.join(dir, 'package.ps1'), generatePackageScript(config));

  // Write metaconfig.json
  fs.writeFileSync(path.join(dir, `${configName}.metaconfig.json`), generateMetaconfigString(config));

  console.log(`  ✅ ${configName} (${config.platform}, ${config.resources.length} resources, mode: ${config.mode})`);
}

// ─── Generate configs ────────────────────────────────────

console.log('🔧 Generating E2E test configurations...\n');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// 1. All templates as-is
console.log('📋 Templates:');
for (const tmpl of templates) {
  writeConfig(tmpl.config.configName, tmpl.config);
}

// 2. Single-resource configs for EVERY schema (skip unsupported)
console.log('\n📋 Single-resource configs (every schema):');
for (const schema of allSchemas) {
  if (GC_UNSUPPORTED_CLASSES.has(schema.mofClassName)) {
    console.log(`  ⏭️  Skipping ${schema.resourceName} (unsupported in GC)`);
    continue;
  }
  const configName = `Single_${schema.resourceName}`;
  const instance = buildInstance(schema.resourceName, `Test${schema.resourceName}`);
  const config: ConfigurationState = {
    configName,
    platform: schema.platform as 'Windows' | 'Linux',
    mode: 'Audit',
    version: '1.0.0',
    description: `Single resource test: ${schema.resourceName}`,
    resources: [instance],
  };
  writeConfig(configName, config);
}

// 3. Multi-module Windows config (all 5 modules)
console.log('\n📋 Multi-module configs:');
{
  const resources: ResourceInstance[] = [
    buildInstance('Registry', 'RegTest', { Key: 'HKLM:\\SOFTWARE\\Test', ValueName: 'TestVal', ValueData: ['1'], ValueType: 'Dword' }),
    buildInstance('Service', 'SvcTest', { Name: 'wuauserv' }),
    buildInstance('AccountPolicy', 'AcctTest', { Name: 'PasswordPolicy', Minimum_Password_Length: 14 }),
    buildInstance('AuditPolicySubcategory', 'AuditTest', { Name: 'Logon', AuditFlag: 'Success', Ensure: 'Present' }),
    buildInstance('Firewall', 'FwTest', { Name: 'AllowHTTPS', Action: 'Allow', Direction: 'Inbound', Protocol: 'TCP', LocalPort: ['443'], Ensure: 'Present' }),
    buildInstance('ScheduledTask', 'TaskTest', { TaskName: 'TestTask', ActionExecutable: 'C:\\test.exe', ScheduleType: 'Daily' }),
    buildInstance('TimeZone', 'TzTest', { IsSingleInstance: 'Yes', TimeZone: 'UTC' }),
    buildInstance('PowerPlan', 'PpTest', { IsSingleInstance: 'Yes', Name: 'High performance' }),
  ];
  const config: ConfigurationState = {
    configName: 'MultiModule_AllWindows',
    platform: 'Windows',
    mode: 'Audit',
    version: '1.0.0',
    description: 'All 5 Windows DSC modules in one config',
    resources,
  };
  writeConfig('MultiModule_AllWindows', config);
}

// 4. Multi-resource Linux (all Linux resource types)
{
  const resources: ResourceInstance[] = [
    buildInstance('nxFileLine', 'SshLine', { FilePath: '/etc/ssh/sshd_config', ContainsLine: 'PermitRootLogin no', DoesNotContainPattern: '^PermitRootLogin yes' }),
    buildInstance('nxFile', 'EtcPasswd', { DestinationPath: '/etc/passwd', Owner: 'root', Group: 'root', Mode: '0644', Type: 'File', Ensure: 'Present' }),
    buildInstance('nxGroup', 'RootGroup', { GroupName: 'root', Ensure: 'Present' }),
    buildInstance('nxUser', 'TestUser', { UserName: 'testuser', Ensure: 'Present' }),
    buildInstance('nxPackage', 'OpenSSH', { Name: 'openssh-server', PackageManager: 'apt', Ensure: 'Present' }),
    buildInstance('nxService', 'SshService', { Name: 'sshd', Controller: 'systemd', Enabled: true, State: 'Running' }),
    buildInstance('nxFileContentReplace', 'PassMaxDays', { FilePath: '/etc/login.defs', EnsureExpectedContent: 'PASS_MAX_DAYS\\s+90' }),
  ];
  const config: ConfigurationState = {
    configName: 'MultiResource_AllLinux',
    platform: 'Linux',
    mode: 'Audit',
    version: '1.0.0',
    description: 'All Linux resource types in one config',
    resources,
  };
  writeConfig('MultiResource_AllLinux', config);
}

// 5. AuditAndSet mode for each platform
console.log('\n📋 AuditAndSet mode configs:');
{
  const config: ConfigurationState = {
    configName: 'AuditAndSet_Windows',
    platform: 'Windows',
    mode: 'AuditAndSet',
    version: '1.0.0',
    description: 'Windows remediation mode test',
    resources: [
      buildInstance('Registry', 'RemediateReg', { Key: 'HKLM:\\SOFTWARE\\Test', ValueName: 'Enforce', ValueData: ['1'], ValueType: 'Dword', Ensure: 'Present' }),
    ],
  };
  writeConfig('AuditAndSet_Windows', config);
}
{
  const config: ConfigurationState = {
    configName: 'AuditAndSet_Linux',
    platform: 'Linux',
    mode: 'AuditAndSet',
    version: '1.0.0',
    description: 'Linux remediation mode test',
    resources: [
      buildInstance('nxScript', 'RemediateSysctl', {
        GetScript: '$val = (sysctl -n net.ipv4.ip_forward 2>/dev/null).Trim(); $msg = if ($val -eq "0") { "Correct" } else { "Wrong: $val" }; return @{ Reasons = @([Reason]@{ Code = "Test:Sysctl:Check"; Phrase = $msg }) }',
        TestScript: '$val = (sysctl -n net.ipv4.ip_forward 2>/dev/null).Trim(); return ($val -eq "0")',
        SetScript: 'sysctl -w net.ipv4.ip_forward=0',
      }),
    ],
  };
  writeConfig('AuditAndSet_Linux', config);
}

// 6. DependsOn chain test
console.log('\n📋 DependsOn chain configs:');
{
  const svc: ResourceInstance = {
    id: 'svc1', schemaName: 'Service', instanceName: 'Firewall',
    properties: { Name: 'MpsSvc', State: 'Running', Ensure: 'Present' },
    dependsOn: [],
  };
  const fw: ResourceInstance = {
    id: 'fw1', schemaName: 'Firewall', instanceName: 'AllowHTTPS',
    properties: { Name: 'AllowHTTPS', Action: 'Allow', Direction: 'Inbound', Protocol: 'TCP', LocalPort: ['443'], Ensure: 'Present' },
    dependsOn: ['svc1'],
  };
  const reg: ResourceInstance = {
    id: 'reg1', schemaName: 'Registry', instanceName: 'LogFirewall',
    properties: { Key: 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\WindowsFirewall', ValueName: 'EnableLogging', ValueData: ['1'], ValueType: 'Dword' },
    dependsOn: ['fw1'],
  };
  const config: ConfigurationState = {
    configName: 'DependsOn_Chain',
    platform: 'Windows',
    mode: 'Audit',
    version: '1.0.0',
    description: 'Three-resource dependency chain',
    resources: [svc, fw, reg],
  };
  writeConfig('DependsOn_Chain', config);
}

// 7. Edge cases
console.log('\n📋 Edge case configs:');

// Special characters in strings
{
  const config: ConfigurationState = {
    configName: 'EdgeCase_SpecialChars',
    platform: 'Windows',
    mode: 'Audit',
    version: '1.0.0',
    description: 'Special characters in values',
    resources: [
      buildInstance('Registry', 'SpecialChars', {
        Key: 'HKLM:\\SOFTWARE\\Test\\Sub Key',
        ValueName: 'Path With Spaces',
        ValueData: ['C:\\Program Files\\My App\\config.ini'],
        ValueType: 'String',
      }),
      buildInstance('SecurityOption', 'LogonMsg', {
        Name: 'LogonMessage',
        Interactive_logon_Message_text_for_users_attempting_to_log_on: 'WARNING: Unauthorized access is prohibited. All activity is monitored & logged.\nViolators will be prosecuted.',
      }),
    ],
  };
  writeConfig('EdgeCase_SpecialChars', config);
}

// Maximum resources (all supported Windows types)
{
  const windowsSchemas = allSchemas.filter(s => s.platform === 'Windows' && !GC_UNSUPPORTED_CLASSES.has(s.mofClassName));
  const resources = windowsSchemas.map(s => buildInstance(s.resourceName, `Max${s.resourceName}`));
  const config: ConfigurationState = {
    configName: 'EdgeCase_MaxWindowsResources',
    platform: 'Windows',
    mode: 'Audit',
    version: '1.0.0',
    description: `All ${windowsSchemas.length} supported Windows resources in one config`,
    resources,
  };
  writeConfig('EdgeCase_MaxWindowsResources', config);
}

// nxScript with complex bash in pwsh
{
  const config: ConfigurationState = {
    configName: 'EdgeCase_ComplexNxScript',
    platform: 'Linux',
    mode: 'Audit',
    version: '1.0.0',
    description: 'Complex bash commands in nxScript',
    resources: [
      buildInstance('nxScript', 'ComplexBash', {
        GetScript: `$users = @(awk -F: '($3 == 0) { print $1 }' /etc/passwd); $msg = if ($users.Count -le 1) { "Only root has UID 0" } else { "Multiple UID 0 users: $($users -join ', ')" }; return @{ Reasons = @([Reason]@{ Code = "Test:UID:Check"; Phrase = $msg }) }`,
        TestScript: `$users = @(awk -F: '($3 == 0) { print $1 }' /etc/passwd); return ($users.Count -le 1)`,
        SetScript: 'throw "Audit only"',
      }),
    ],
  };
  writeConfig('EdgeCase_ComplexNxScript', config);
}

// Summary
const configDirs = fs.readdirSync(OUTPUT_DIR).filter(d => fs.statSync(path.join(OUTPUT_DIR, d)).isDirectory());
console.log(`\n✅ Generated ${configDirs.length} test configurations in ${OUTPUT_DIR}`);
