/**
 * Integration tests — full pipeline validation.
 *
 * Tests every schema and every template through the complete generation pipeline:
 * ConfigurationState → all generators → valid outputs.
 *
 * This catches wiring issues that unit tests miss:
 * - Schema properties that crash a generator
 * - Templates with stale/invalid resource references
 * - Bundle generation failures
 * - Cross-generator consistency (MOF class names match schema, policy JSON is valid, etc.)
 */

import { describe, it, expect } from 'vitest';
import { allSchemas, schemasByName } from '../../schemas';
import { templates } from '../../templates';
import { ConfigurationState, ResourceInstance } from '../../types';
import { generateMofContent } from '../mofGenerator';
import { generatePs1 } from '../ps1Generator';
import { generatePolicyJsonString } from '../policyGenerator';
import { generateMetaconfigString } from '../metaconfigGenerator';
import { generatePackageScript } from '../packageScriptGenerator';
import { generateReadme } from '../readmeGenerator';
import { getGeneratedOutputs } from '../bundleGenerator';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a minimal valid ConfigurationState with one resource using test values */
function buildSingleResourceConfig(schemaName: string): ConfigurationState {
  const schema = schemasByName[schemaName];
  if (!schema) throw new Error(`Unknown schema: ${schemaName}`);

  // Fill required properties with plausible test values
  const properties: Record<string, unknown> = {};
  for (const prop of schema.properties) {
    if (!prop.required && !prop.isKey) continue;
    if (prop.defaultValue !== undefined) {
      properties[prop.name] = prop.defaultValue;
      continue;
    }
    switch (prop.type) {
      case 'string':
        properties[prop.name] = prop.enumValues?.[0] ?? prop.placeholder ?? `test-${prop.name}`;
        break;
      case 'string[]':
        properties[prop.name] = [prop.enumValues?.[0] ?? 'test-value'];
        break;
      case 'boolean':
        properties[prop.name] = true;
        break;
      case 'integer':
        properties[prop.name] = 1;
        break;
    }
  }

  const resource: ResourceInstance = {
    id: 'test-resource-1',
    schemaName,
    instanceName: `Test${schema.resourceName}`,
    properties,
    dependsOn: [],
  };

  return {
    configName: `Test_${schema.resourceName}`,
    platform: schema.platform,
    mode: 'Audit',
    version: '1.0.0',
    description: `Integration test for ${schema.resourceName}`,
    resources: [resource],
  };
}

/** Run all generators and return results + any errors */
function runAllGenerators(config: ConfigurationState) {
  const results: Record<string, string> = {};
  const errors: string[] = [];

  const generators: [string, (c: ConfigurationState) => string][] = [
    ['mof', generateMofContent],
    ['ps1', generatePs1],
    ['policyJson', generatePolicyJsonString],
    ['metaconfig', generateMetaconfigString],
    ['packageScript', generatePackageScript],
    ['readme', generateReadme],
  ];

  for (const [name, gen] of generators) {
    try {
      results[name] = gen(config);
    } catch (e) {
      errors.push(`${name}: ${(e as Error).message}`);
    }
  }

  return { results, errors };
}

// ─── Schema tests ────────────────────────────────────────────────────────────

describe('Every schema through full pipeline', () => {
  for (const schema of allSchemas) {
    describe(`${schema.resourceName} (${schema.platform})`, () => {
      const config = buildSingleResourceConfig(schema.resourceName);

      it('generates all 6 artifacts without errors', () => {
        const { errors } = runAllGenerators(config);
        expect(errors).toEqual([]);
      });

      it('MOF contains the correct class name', () => {
        const mof = generateMofContent(config);
        expect(mof).toContain(`instance of ${schema.mofClassName}`);
      });

      it('MOF contains correct module reference', () => {
        const mof = generateMofContent(config);
        expect(mof).toContain(`ModuleName = "${schema.moduleName}"`);
        expect(mof).toContain(`ModuleVersion = "${schema.moduleVersion}"`);
      });

      it('PS1 contains the resource type', () => {
        const ps1 = generatePs1(config);
        expect(ps1).toContain(schema.resourceName);
      });

      it('policy JSON is valid JSON with required fields', () => {
        const json = generatePolicyJsonString(config);
        const parsed = JSON.parse(json);
        expect(parsed).toHaveProperty('properties');
        expect(parsed.properties).toHaveProperty('displayName');
        expect(parsed.properties).toHaveProperty('policyRule');
        expect(parsed.properties.policyRule).toHaveProperty('if');
        expect(parsed.properties.policyRule).toHaveProperty('then');
      });

      it('metaconfig is valid JSON with Type field', () => {
        const meta = generateMetaconfigString(config);
        const parsed = JSON.parse(meta);
        expect(parsed).toHaveProperty('Type');
        expect(['Audit', 'AuditAndSet']).toContain(parsed.Type);
      });

      it('package.ps1 references the module', () => {
        const script = generatePackageScript(config);
        expect(script).toContain(schema.moduleName);
      });

      it('README is non-empty and contains config name', () => {
        const readme = generateReadme(config);
        expect(readme.length).toBeGreaterThan(100);
        expect(readme).toContain(config.configName);
      });
    });
  }
});

// ─── AuditAndSet mode tests ─────────────────────────────────────────────────

describe('AuditAndSet mode generates DINE policy', () => {
  // Only test resources that support remediation
  const auditAndSetSchemas = allSchemas.filter(s =>
    // Linux nxScript + any Windows resource can be AuditAndSet
    s.platform === 'Linux' ? s.resourceName === 'nxScript' : true
  );

  for (const schema of auditAndSetSchemas.slice(0, 5)) {
    it(`${schema.resourceName} — DINE policy has deployment template`, () => {
      const config = buildSingleResourceConfig(schema.resourceName);
      config.mode = 'AuditAndSet';

      const json = generatePolicyJsonString(config);
      const parsed = JSON.parse(json);
      const effect = parsed.properties.policyRule.then.effect;

      // DINE policies use deployIfNotExists (lowercase per Azure Policy spec)
      expect(effect).toBe('deployIfNotExists');

      const details = parsed.properties.policyRule.then.details;
      expect(details).toHaveProperty('deployment');
      expect(details.deployment).toHaveProperty('properties');
      expect(details.deployment.properties).toHaveProperty('template');
    });
  }
});

// ─── Template tests ──────────────────────────────────────────────────────────

describe('Every template through full pipeline', () => {
  for (const template of templates) {
    describe(`Template: ${template.name}`, () => {
      const config = template.config;

      it('has valid resource count in metadata', () => {
        expect(template.resourceCount).toBe(config.resources.length);
      });

      it('all resources reference valid schemas', () => {
        for (const resource of config.resources) {
          expect(schemasByName[resource.schemaName]).toBeDefined();
        }
      });

      it('platform matches all resource schemas', () => {
        for (const resource of config.resources) {
          const schema = schemasByName[resource.schemaName];
          expect(schema.platform).toBe(config.platform);
        }
      });

      it('generates all 6 artifacts without errors', () => {
        const { errors } = runAllGenerators(config);
        expect(errors).toEqual([]);
      });

      it('MOF contains all resource instances', () => {
        const mof = generateMofContent(config);
        for (const resource of config.resources) {
          const schema = schemasByName[resource.schemaName];
          expect(mof).toContain(`instance of ${schema.mofClassName}`);
        }
      });

      it('policy JSON is valid', () => {
        const json = generatePolicyJsonString(config);
        expect(() => JSON.parse(json)).not.toThrow();
      });

      it('DependsOn references are valid resource IDs', () => {
        const ids = new Set(config.resources.map(r => r.id));
        for (const resource of config.resources) {
          for (const dep of resource.dependsOn) {
            expect(ids.has(dep)).toBe(true);
          }
        }
      });

      it('getGeneratedOutputs returns all 6 keys', () => {
        const outputs = getGeneratedOutputs(config);
        expect(Object.keys(outputs)).toEqual(
          expect.arrayContaining(['mof', 'metaconfig', 'ps1', 'policyJson', 'packageScript', 'readme'])
        );
        for (const value of Object.values(outputs)) {
          expect(typeof value).toBe('string');
          expect(value.length).toBeGreaterThan(0);
        }
      });
    });
  }
});

// ─── Cross-cutting tests ─────────────────────────────────────────────────────

describe('Cross-cutting validation', () => {
  it('every schema has a unique mofClassName', () => {
    const classNames = allSchemas.map(s => s.mofClassName);
    const unique = new Set(classNames);
    expect(unique.size).toBe(classNames.length);
  });

  it('every schema has a unique resourceName', () => {
    const names = allSchemas.map(s => s.resourceName);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it('every schema has at least one key property', () => {
    for (const schema of allSchemas) {
      const keys = schema.properties.filter(p => p.isKey);
      expect(keys.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('schema count matches expected (29)', () => {
    expect(allSchemas.length).toBe(29);
  });

  it('template count matches expected (9)', () => {
    expect(templates.length).toBe(9);
  });

  it('empty config generates valid outputs', () => {
    const emptyConfig: ConfigurationState = {
      configName: 'EmptyConfig',
      platform: 'Windows',
      mode: 'Audit',
      version: '1.0.0',
      description: '',
      resources: [],
    };
    const { errors } = runAllGenerators(emptyConfig);
    expect(errors).toEqual([]);
  });

  it('config with 20 resources generates without errors', () => {
    // Build a config with many Windows resources
    const windowsSchemas = allSchemas.filter(s => s.platform === 'Windows');
    const resources: ResourceInstance[] = windowsSchemas.slice(0, 20).map((schema, i) => {
      const properties: Record<string, unknown> = {};
      for (const prop of schema.properties) {
        if (!prop.required && !prop.isKey) continue;
        if (prop.defaultValue !== undefined) {
          properties[prop.name] = prop.defaultValue;
          continue;
        }
        switch (prop.type) {
          case 'string':
            properties[prop.name] = prop.enumValues?.[0] ?? `test-${prop.name}-${i}`;
            break;
          case 'string[]':
            properties[prop.name] = ['test-value'];
            break;
          case 'boolean':
            properties[prop.name] = true;
            break;
          case 'integer':
            properties[prop.name] = 1;
            break;
        }
      }
      return {
        id: `res-${i}`,
        schemaName: schema.resourceName,
        instanceName: `Res${i}_${schema.resourceName}`,
        properties,
        dependsOn: i > 0 ? [`res-${i - 1}`] : [],
      };
    });

    const config: ConfigurationState = {
      configName: 'ManyResources',
      platform: 'Windows',
      mode: 'Audit',
      version: '1.0.0',
      description: 'Stress test',
      resources,
    };

    const { errors } = runAllGenerators(config);
    expect(errors).toEqual([]);
  });
});
