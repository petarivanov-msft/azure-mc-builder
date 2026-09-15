import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { getOfficialProjectFiles, generateOfficialProject, validateOfficialConfig } from '../officialProjectGenerator';
import { createProjectSettings, parseConfiguration } from '../../utils/configuration';
import { useConfigStore } from '../../store/configStore';
import type { ConfigurationState } from '../../types';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { generateMofContent } from '../mofGenerator';
import { generatePs1 } from '../ps1Generator';

function fixture(): ConfigurationState {
  return { configName: 'OfficialTest', platform: 'Windows', mode: 'Audit', version: '1.2.3',
    description: '', project: { ...createProjectSettings(), workflow: 'official' },
    resources: [{ id: '1', schemaName: 'Registry', instanceName: 'Marker',
      properties: { Key: 'HKLM:\\SOFTWARE\\MCBuilderVerification', ValueName: 'Marker', ValueData: ['verified'], ValueType: 'String' }, dependsOn: [] }] };
}

describe('official authoring project', () => {
  it.each(['Mode', 'Owner', 'Group'])('requires explicit nxFile %s only for file-creation remediation', field => {
    const config = fixture();
    config.platform = 'Linux';
    config.mode = 'AuditAndSet';
    config.resources = [{ id: '1', schemaName: 'nxFile', instanceName: 'Marker', dependsOn: [],
      properties: { DestinationPath: '/var/tmp/mc-test', Ensure: 'Present', Mode: '0644', Owner: 'root', Group: 'root' } }];
    delete config.resources[0].properties[field];
    for (const generate of [getOfficialProjectFiles, generateMofContent, generatePs1]) {
      expect(() => generate(config)).toThrow(`nxFile ${field} must be explicit`);
    }
    const store = useConfigStore.getState();
    store.importJSON(JSON.stringify(config));
    expect(store.validate().some(e => e.field === field && e.level === 'error')).toBe(true);
    expect(config.resources[0].properties).not.toHaveProperty(field);
    config.mode = 'Audit';
    expect(() => getOfficialProjectFiles(config)).not.toThrow();
    config.mode = 'AuditAndSet';
    config.resources[0].properties.Ensure = 'Absent';
    expect(() => getOfficialProjectFiles(config)).not.toThrow();
  });

  it('does not replace empty ownership with a silent root default', () => {
    const config = fixture();
    config.platform = 'Linux'; config.mode = 'AuditAndSet';
    config.resources = [{ id: '1', schemaName: 'nxFile', instanceName: 'Marker', dependsOn: [],
      properties: { DestinationPath: '/var/tmp/mc-test', Mode: '0644', Owner: 'root', Group: ' ' } }];
    expect(() => getOfficialProjectFiles(config)).toThrow('Group must be explicit');
    expect(config.resources[0].properties.Group).toBe(' ');
  });

  it('executes fail-closed runtime contracts without contacting Azure', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mc-contract-'));
    try {
      for (const [name, content] of Object.entries(getOfficialProjectFiles(fixture()))) writeFileSync(join(dir, name), content);
      const result = spawnSync('pwsh', ['-NoProfile', '-NonInteractive', '-File',
        resolve('e2e', 'test-official-runtime.ps1'), '-ProjectPath', dir],
      { encoding: 'utf8', timeout: 120_000, windowsHide: true });
      expect(result.error).toBeUndefined();
      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
      expect(result.stdout).toContain('Official runtime contract checks passed');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }, 130_000);
  it('exports source and shared runtime, not handwritten final artifacts', async () => {
    const config = fixture();
    const files = getOfficialProjectFiles(config);
    expect(files['Configuration.ps1']).toContain('Configuration OfficialTest_v1_2_3');
    expect(files['McBuilder.psm1']).toContain('New-GuestConfigurationPolicy @parameters');
    expect(files['McBuilder.psm1']).toContain('IncludeVMSS = $false');
    expect(files['McBuilder.psm1']).not.toContain('Remove-AzPolicyDefinition');
    expect(files['toolchain.lock.json']).toContain('4.12.0');
    expect(files).not.toHaveProperty('policy.json');
    expect(Object.keys(files).some(n => n.endsWith('.mof') || n.endsWith('.metaconfig.json'))).toBe(false);
    const archive = await JSZip.loadAsync(await (await generateOfficialProject(config)).arrayBuffer());
    expect(await archive.file('McBuilder.psm1')!.async('string')).toBe(files['McBuilder.psm1']);
    expect(JSON.parse(await archive.file('config.json')!.async('string')).project.policyId).toBe(config.project!.policyId);
    expect(JSON.parse(getOfficialProjectFiles(config)['config.json']).project.policyId).toBe(config.project!.policyId);
  });

  it('migrates old identity once and round-trips the identity across imports', () => {
    const old = fixture(); delete old.project;
    const imported = parseConfiguration(JSON.stringify(old));
    expect(imported.project!.definitionName).toBe('MC-OfficialTest');
    expect(parseConfiguration(JSON.stringify(imported)).project).toEqual(imported.project);
    expect(imported.project!.workflow).toBe('legacy');
  });

  it('keeps unfinished legacy names editable and reloadable after migration', () => {
    const old = fixture(); delete old.project; old.configName = 'unfinished name';
    const imported = parseConfiguration(JSON.stringify(old));
    expect(imported.project!.definitionName).toBe(imported.project!.policyId);
    expect(parseConfiguration(JSON.stringify(imported)).configName).toBe('unfinished name');
  });

  it('migrates the invalid battery property without reversing intent', () => {
    const config = fixture();
    config.resources = [{ id: '1', schemaName: 'ScheduledTask', instanceName: 'Task',
      properties: { TaskName: 'T', DisallowStartIfOnBatteries: true }, dependsOn: [] }];
    const imported = parseConfiguration(JSON.stringify(config));
    expect(imported.resources[0].properties.AllowStartIfOnBatteries).toBe(false);
    expect(imported.resources[0].properties).not.toHaveProperty('DisallowStartIfOnBatteries');
    expect(getOfficialProjectFiles(config)['Configuration.ps1']).toContain('AllowStartIfOnBatteries = $false');
  });

  it('preserves identity across workflow selection and undo, but new projects get a new one', () => {
    const store = useConfigStore.getState();
    store.importJSON(JSON.stringify(fixture()));
    const id = useConfigStore.getState().project.policyId;
    store.setWorkflow('legacy'); store.undo();
    expect(useConfigStore.getState().project.policyId).toBe(id);
    expect(useConfigStore.getState().project.workflow).toBe('official');
    store.resetConfig();
    expect(useConfigStore.getState().project.policyId).not.toBe(id);
  });

  it.each([['ValueData', 'not-an-array'], ['Force', 'false'], ['UnknownProperty', 'value']])('rejects invalid property %s', (name, value) => {
    const config = fixture(); config.resources[0].properties[name] = value;
    expect(() => validateOfficialConfig(config)).toThrow();
  });

  it('rejects dangling and circular dependencies and case-insensitive duplicate names', () => {
    const config = fixture();
    config.resources[0].dependsOn = ['unknown'];
    expect(() => validateOfficialConfig(config)).toThrow('Unknown DependsOn');
    config.resources[0].dependsOn = ['1'];
    expect(() => validateOfficialConfig(config)).toThrow('Circular');
    config.resources[0].dependsOn = [];
    config.resources.push({ ...config.resources[0], id: '2', instanceName: 'marker' });
    expect(() => validateOfficialConfig(config)).toThrow('unique');
  });
});
