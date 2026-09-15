import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('repository deploy wrapper delegates project arguments without an alternate deployment implementation', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mc-wrapper-'));
  try {
    mkdirSync(join(dir, 'scripts'));
    writeFileSync(join(dir, 'deploy.ps1'), readFileSync(resolve('deploy.ps1')));
    const downloadedWrapper = readFileSync(resolve('scripts', 'deploy.ps1'), 'utf8')
      .replace(/^Import-Module.*$/m, '')
      .replace('Publish-McPackage @PSBoundParameters', '$PSBoundParameters | ConvertTo-Json -Compress');
    writeFileSync(join(dir, 'scripts', 'deploy.ps1'), downloadedWrapper);
    for (const parameter of ['-ProjectPath', '-OfficialProjectPath']) {
      const result = spawnSync('pwsh', ['-NoProfile', '-NonInteractive', '-File', join(dir, 'deploy.ps1'),
        parameter, dir, '-TenantId', 'test-tenant', '-SubscriptionId', 'test-subscription',
        '-StorageAccountName', 'teststorage', '-UseAzureCli', '-SasExpiryDays', '2'],
      { encoding: 'utf8', timeout: 60_000, windowsHide: true });
      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr).toBe(0);
      const args = JSON.parse(result.stdout);
      expect(args.ProjectPath).toBe(dir);
      expect(args.TenantId).toBe('test-tenant');
      expect(args.SubscriptionId).toBe('test-subscription');
      expect(args.SasExpiryDays).toBe(2);
      expect(args.UseAzureCli.IsPresent).toBe(true);
    }
    const source = readFileSync(join(dir, 'deploy.ps1'), 'utf8');
    expect(source).not.toMatch(/\$(ConfigPath|PackagePath|StorageAuthMode)\b/);
    expect(source).not.toContain('New-AzPolicyDefinition');
  } finally { rmSync(dir, { recursive: true, force: true }); }
}, 130_000);
