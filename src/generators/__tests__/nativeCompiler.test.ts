import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { allSchemas } from '../../schemas';
import { templates } from '../../templates';
import { generatePs1 } from '../ps1Generator';
import type { ConfigurationState } from '../../types';

const platform = process.platform === 'win32' ? 'Windows' : 'Linux';
const fixtures: ConfigurationState[] = allSchemas.filter(s => s.platform === platform).map(schema => {
  const properties: Record<string, unknown> = {};
  for (const p of schema.properties) {
    if (p.defaultValue !== undefined) properties[p.name] = p.defaultValue;
    else if (p.required || p.isKey) {
      const value = p.enumValues?.[0] ?? p.placeholder ?? `Test${p.name}`;
      properties[p.name] = p.type === 'string[]' ? [value] :
        p.type === 'boolean' ? true : p.type === 'integer' ? 1 : value;
    }
  }
  return { configName: `Native_${schema.resourceName}`, version: '1.0.0', platform,
    mode: 'Audit', description: 'Compiler qualification', resources: [{
      id: 'test', schemaName: schema.resourceName, instanceName: 'Test', properties, dependsOn: [],
    }] };
});
fixtures.push(...templates.filter(t => t.platform === platform).map(t => t.config));

describe.skipIf(process.env.MC_NATIVE_TESTS !== '1')('official DSC compilation', () => {
  for (const config of fixtures) {
    it(`compiles ${config.configName} without handwritten MOF`, () => {
      const dir = mkdtempSync(join(tmpdir(), 'mc-compile-'));
      try {
        writeFileSync(join(dir, 'source.ps1'), generatePs1(config));
        writeFileSync(join(dir, 'compile.ps1'), `
$ErrorActionPreference = 'Stop'
Import-Module PSDesiredStateConfiguration -RequiredVersion '${platform === 'Windows' ? '2.0.7' : '3.0.0'}'
. (Join-Path $PSScriptRoot 'source.ps1')
& '${config.configName}' -OutputPath (Join-Path $PSScriptRoot 'compiled') | Out-Null
`);
        const result = spawnSync('pwsh', ['-NoProfile', '-NonInteractive', '-File', join(dir, 'compile.ps1')],
          { encoding: 'utf8', timeout: 120_000, windowsHide: true });
        expect(result.error).toBeUndefined();
        expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
        const mof = readFileSync(join(dir, 'compiled', 'localhost.mof'), 'utf8');
        for (const resource of config.resources) expect(mof).toContain(resource.instanceName);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }, 130_000);
  }
});
