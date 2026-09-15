import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';
import { getOfficialProjectFiles } from '../officialProjectGenerator';
import { createProjectSettings } from '../../utils/configuration';
import type { ConfigurationState } from '../../types';

it.skipIf(process.env.MC_NATIVE_RUNTIME !== '1')('builds real official packages and evaluates the safe Audit fixture', () => {
  const persistent = process.env.MC_ARTIFACT_DIR;
  const root = persistent ?? mkdtempSync(join(tmpdir(), 'mc-native-runtime-'));
  const platform = process.platform === 'win32' ? 'Windows' : 'Linux';
  try {
    for (const mode of ['Audit', 'AuditAndSet'] as const) {
      const config: ConfigurationState = {
        configName: `MCVerify${platform}${mode}`, platform, mode, version: '1.0.0',
        description: 'Isolated MC Builder validation: harmless marker only',
        project: { ...createProjectSettings(), workflow: 'official', includeArc: true },
        resources: [{ id: 'marker', instanceName: 'Marker', dependsOn: [],
          schemaName: platform === 'Windows' ? 'Registry' : 'nxFile',
          properties: platform === 'Windows' ? {
            Key: 'HKLM:\\SOFTWARE\\MCBuilderVerification', ValueName: mode,
            ValueData: ['verified'], ValueType: 'String', Ensure: 'Present',
          } : { DestinationPath: `/var/tmp/mc-builder-${mode.toLowerCase()}`, Contents: 'verified', Type: 'File', Ensure: 'Present', Mode: '0644' },
        }],
      };
      const dir = join(root, config.configName);
      mkdirSync(dir, { recursive: true });
      for (const [name, content] of Object.entries(getOfficialProjectFiles(config))) writeFileSync(join(dir, name), content);
      const run = (file: string, args: string[] = []) => {
        const result = spawnSync('pwsh', ['-NoProfile', '-NonInteractive', '-File', join(dir, file), ...args],
          { encoding: 'utf8', timeout: 600_000, windowsHide: true, maxBuffer: 10 * 1024 * 1024 });
        expect(result.error).toBeUndefined();
        expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
      };
      run('package.ps1', ['-RestoreTools']);
      const build = JSON.parse(readFileSync(join(dir, 'output', 'build.json'), 'utf8').replace(/^\uFEFF/, ''));
      expect(build.guestConfiguration).toBe('4.12.0');
      expect(build.releaseName).toBe(`${config.configName}_v1_0_0`);
      if (mode === 'Audit' || process.env.MC_NATIVE_REMEDIATE === '1') {
        const args = ['-AcknowledgeExecution', ...(mode === 'AuditAndSet' ? ['-Remediate', '-DisposableEnvironment'] : [])];
        run('test.ps1', args);
        const validation = JSON.parse(readFileSync(join(dir, 'output', 'validation.json'), 'utf8').replace(/^\uFEFF/, ''));
        expect(validation.status).toBe('Validated');
        expect(validation.packageHash).toBe(build.packageHash);
        expect(validation.remediationVerified).toBe(mode === 'AuditAndSet');
        writeFileSync(join(dir, 'verify-policy.ps1'), `
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'McBuilder.psm1') -Force
$policy = New-McPolicy -ProjectPath $PSScriptRoot -ContentUri 'https://example.invalid/package.zip' -UseSystemAssignedIdentity
$document = Get-Content -LiteralPath $policy.Path -Raw | ConvertFrom-Json
if ($document.properties.metadata.guestConfiguration.contentHash -cne '${build.packageHash}') { throw 'Official policy hash mismatch' }
if (($document | ConvertTo-Json -Depth 100) -match 'virtualMachineScaleSets') { throw 'Unexpected VMSS targeting' }
if ($document.properties.policyRule.then.effect -ne '${mode === 'Audit' ? 'auditIfNotExists' : 'deployIfNotExists'}') { throw 'Unexpected official policy effect' }
`);
        run('verify-policy.ps1');
        if (mode === 'AuditAndSet') {
          writeFileSync(join(dir, 'reset-fixture.ps1'), platform === 'Windows'
            ? "Remove-ItemProperty -LiteralPath 'HKLM:\\SOFTWARE\\MCBuilderVerification' -Name 'AuditAndSet' -ErrorAction Stop"
            : "Remove-Item -LiteralPath '/var/tmp/mc-builder-auditandset' -ErrorAction Stop");
          run('reset-fixture.ps1');
          run('test.ps1', args);
          const drift = JSON.parse(readFileSync(join(dir, 'output', 'validation.json'), 'utf8').replace(/^\uFEFF/, ''));
          expect(String(drift.evaluations[0].complianceStatus).toLowerCase()).toMatch(/^(false|noncompliant)$/);
          expect(drift.remediationVerified).toBe(true);
        }
      }
    }
  } finally {
    if (!persistent) rmSync(root, { recursive: true, force: true });
  }
}, 1_500_000);
