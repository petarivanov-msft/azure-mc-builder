import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import type { ConfigurationState } from '../../types';
import { generateMofContent } from '../mofGenerator';
import { generatePs1 } from '../ps1Generator';
import { generatePolicyJson } from '../policyGenerator';
import { generateMetaconfig } from '../metaconfigGenerator';
import { generatePackageScript } from '../packageScriptGenerator';
import { generateDeployScript } from '../deployScriptGenerator';
import { generateBundle } from '../bundleGenerator';

const base: ConfigurationState = {
  configName: 'RegressionTest', platform: 'Windows', mode: 'Audit',
  version: '2.3.4', description: '', resources: [],
};

describe('generator boundaries and defaults', () => {
  const generators = [generateMofContent, generatePs1, generatePolicyJson,
    generateMetaconfig, generatePackageScript, generateDeployScript];

  it.each(['bad"name', 'bad\nname', '../escape', "bad'name", '123name', ''])('rejects invalid name %j in every entry point', configName => {
    for (const generate of generators) {
      expect(() => generate({ ...base, configName })).toThrow('valid identifier');
    }
  });

  it('rejects invalid instance names without relying on UI validation', () => {
    for (const generate of generators) {
      expect(() => generate({ ...base, resources: [{
        id: '1', schemaName: 'Service', instanceName: 'bad";', properties: { Name: 'test' }, dependsOn: [],
      }] })).toThrow('Invalid instance name');
    }
  });

  it.each(['bad', "1.0.0';bad", '', '1.0'])('rejects invalid version %j', version => {
    for (const generate of generators) expect(() => generate({ ...base, version })).toThrow('Version');
  });

  it.each(['TimeZone', 'PowerPlan'])('emits missing required schema defaults for %s without mutating input', schemaName => {
    const config = { ...base, resources: [{
      id: '1', schemaName, instanceName: 'DefaultTest',
      properties: schemaName === 'TimeZone' ? { TimeZone: 'UTC' } : { Name: 'Balanced' }, dependsOn: [],
    }] };
    expect(generateMofContent(config)).toContain('IsSingleInstance = "Yes";');
    expect(generatePs1(config)).toContain("IsSingleInstance = 'Yes'");
    expect(config.resources[0].properties).not.toHaveProperty('IsSingleInstance');
  });

  it.each([null, ''])('does not hide an explicitly invalid required value %j with a default', IsSingleInstance => {
    const config = { ...base, resources: [{
      id: '1', schemaName: 'TimeZone', instanceName: 'TZ',
      properties: { IsSingleInstance, TimeZone: 'UTC' }, dependsOn: [],
    }] };
    expect(() => generateMofContent(config)).toThrow('Required property');
    expect(() => generatePs1(config)).toThrow('Required property');
  });

  it('preserves empty Registry ValueName in both MOF and reference PowerShell', () => {
    const config = { ...base, resources: [{
      id: '1', schemaName: 'Registry', instanceName: 'DefaultValue',
      properties: { Key: 'HKLM:\\SOFTWARE\\Test', ValueName: '' }, dependsOn: [],
    }] };
    expect(generateMofContent(config)).toContain('ValueName = "";');
    expect(generatePs1(config)).toContain("ValueName = ''");
  });

  it('rejects comma-separated alternatives for a single-valued enum', () => {
    expect(() => generateMofContent({ ...base, resources: [{
      id: '1', schemaName: 'Service', instanceName: 'Svc',
      properties: { Name: 'test', State: 'Running,Stopped' }, dependsOn: [],
    }] })).toThrow('Invalid value');
  });

  it.each(['Audit', 'AuditAndSet'] as const)('keeps %s bundle metadata and packaging inputs aligned', async mode => {
    const config = { ...base, mode, resources: [{
      id: '1', schemaName: 'Service', instanceName: 'Svc', properties: { Name: 'test' }, dependsOn: [],
    }] };
    const blob = await generateBundle(config);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const metadata = JSON.parse(await zip.file(`${base.configName}.metaconfig.json`)!.async('string'));
    expect(metadata).toEqual({ Type: mode, Version: base.version });
    const script = await zip.file('package.ps1')!.async('string');
    expect(script).toContain('-Type $metadata.Type');
    expect(script).toContain('-Version $metadata.Version');
    expect(script).not.toMatch(/\$matches\s*=/i);
    expect(await zip.file('deploy.ps1')!.async('string')).not.toMatch(/\$matches\s*=/i);
  });
});
