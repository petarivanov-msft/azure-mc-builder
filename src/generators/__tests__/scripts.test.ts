import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';
import type { ConfigurationState } from '../../types';
import { generateMofContent } from '../mofGenerator';
import { generateMetaconfigString } from '../metaconfigGenerator';
import { generatePackageScript } from '../packageScriptGenerator';
import { generateDeployScript } from '../deployScriptGenerator';
import { generatePolicyJsonString } from '../policyGenerator';

it('executes both deployment entry points and generated packagers against isolated PowerShell mocks', () => {
  const temp = mkdtempSync(join(tmpdir(), 'mc-script-regression-'));
  try {
    for (const mode of ['Audit', 'AuditAndSet'] as const) {
      const dir = join(temp, mode);
      mkdirSync(dir);
      const config: ConfigurationState = {
        configName: 'ScriptRegression', platform: 'Windows', mode,
        version: '2.3.4', description: 'Script tests',
        resources: [{ id: '1', schemaName: 'Service', instanceName: 'Svc', properties: { Name: 'test' }, dependsOn: [] }],
      };
      writeFileSync(join(dir, `${config.configName}.mof`), generateMofContent(config));
      writeFileSync(join(dir, `${config.configName}.metaconfig.json`), generateMetaconfigString(config));
      writeFileSync(join(dir, 'package.ps1'), generatePackageScript(config));
      writeFileSync(join(dir, 'deploy.ps1'), generateDeployScript(config));
      writeFileSync(join(dir, 'policy.json'), generatePolicyJsonString(config));
    }
    writeFileSync(join(temp, 'root-deploy.ps1'), readFileSync(resolve('deploy.ps1')));
    const result = spawnSync('pwsh', ['-NoProfile', '-NonInteractive', '-File',
      resolve('e2e', 'test-generated-scripts.ps1'), '-InputDir', temp], {
      encoding: 'utf8', timeout: 120_000, windowsHide: true,
    });
    expect(result.error, 'PowerShell 7 is required for script regression tests').toBeUndefined();
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain('All script regression checks passed');
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}, 130_000);
