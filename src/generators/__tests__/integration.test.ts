import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { allSchemas, schemasByName } from '../../schemas';
import { templates } from '../../templates';
import { createProjectSettings, parseConfiguration } from '../../utils/configuration';
import { generateBundle, getOfficialProjectFiles } from '../index';
import { schemaConfig } from './fixtures';

describe('every catalog resource through the sole authoring workflow', () => {
  for (const schema of allSchemas) {
    for (const mode of ['Audit', 'AuditAndSet'] as const) {
      it(`${schema.resourceName} / ${mode} exports a complete source project`, () => {
        const config = schemaConfig(schema.resourceName, mode);
        const files = getOfficialProjectFiles(config);
        const saved = JSON.parse(files['config.json']);
        expect(saved.platform).toBe(schema.platform);
        expect(saved.mode).toBe(mode);
        expect(saved.dependencies).toContainEqual({ name: schema.moduleName, version: schema.moduleVersion });
        expect(saved.project.policyId).toBe(config.project!.policyId);
        expect(saved.project).not.toHaveProperty('workflow');
        expect(files['Configuration.ps1']).toContain(`${schema.resourceName} 'Test${schema.resourceName}'`);
        expect(files['McBuilder.psm1']).toContain('New-GuestConfigurationPackage');
        expect(files['McBuilder.psm1']).toContain('New-GuestConfigurationPolicy');
        expect(files['README.md']).toContain(config.configName);
        expect(files).not.toHaveProperty('policy.json');
        expect(Object.keys(files).some(name => name.endsWith('.mof') || name.endsWith('.metaconfig.json'))).toBe(false);
      });
    }
  }
});

describe('saved templates and real browser downloads', () => {
  for (const template of templates) {
    it(`${template.name} round-trips all resources and dependencies`, async () => {
      const config = { ...template.config, project: createProjectSettings() };
      expect(template.resourceCount).toBe(config.resources.length);
      const ids = new Set(config.resources.map(r => r.id));
      for (const resource of config.resources) {
        expect(schemasByName[resource.schemaName].platform).toBe(config.platform);
        for (const id of resource.dependsOn) expect(ids.has(id)).toBe(true);
      }
      const blob = await generateBundle(config);
      const zip = await JSZip.loadAsync(await blob.arrayBuffer());
      const imported = parseConfiguration(await zip.file('config.json')!.async('string'));
      expect(imported.project).toEqual(config.project);
      expect(imported.resources.map(r => r.id)).toEqual(config.resources.map(r => r.id));
      const source = await zip.file('Configuration.ps1')!.async('string');
      for (const resource of config.resources) expect(source).toContain(`'${resource.instanceName}'`);
      for (const file of ['package.ps1', 'test.ps1', 'deploy.ps1', 'compile.ps1', 'McBuilder.psm1', 'toolchain.lock.json', 'README.md']) {
        expect((await zip.file(file)!.async('string')).length).toBeGreaterThan(0);
      }
    });
  }
  it('cannot select retired artifacts through stale saved metadata', async () => {
    const config = schemaConfig('Service');
    const old = { ...config, project: { ...config.project!, workflow: 'legacy' } };
    const zip = await JSZip.loadAsync(await (await generateBundle(old)).arrayBuffer());
    expect(zip.file('Configuration.ps1')).not.toBeNull();
    expect(zip.file('policy.json')).toBeNull();
    expect(JSON.parse(await zip.file('config.json')!.async('string')).project).not.toHaveProperty('workflow');
  });
  it('rejects an empty source project instead of manufacturing deployment artifacts', () => {
    const config = schemaConfig('Service'); config.resources = [];
    expect(() => getOfficialProjectFiles(config)).toThrow('at least one resource');
  });
  it('exports every supported Windows resource together with unique identities', () => {
    const config = schemaConfig('Service');
    config.resources = allSchemas.filter(s => s.platform === 'Windows').map(s => schemaConfig(s.resourceName).resources[0]);
    const files = getOfficialProjectFiles(config);
    for (const resource of config.resources) expect(files['Configuration.ps1']).toContain(`'${resource.instanceName}'`);
    expect(JSON.parse(files['config.json']).dependencies).toHaveLength(5);
  });
});
