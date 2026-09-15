import JSZip from 'jszip';
import type { ConfigurationState } from '../types';
import { schemasByName } from '../schemas';
import { assertValidIdentifiers, getPropertyValue, isMissingProperty, withResourceDefaults } from '../utils/configuration';
import { generatePs1 } from './ps1Generator';
import runtime from '../../scripts/McBuilder.psm1?raw';
import compiler from '../../scripts/compile.ps1?raw';
import packager from '../../scripts/package.ps1?raw';
import tester from '../../scripts/test.ps1?raw';
import deployer from '../../scripts/deploy.ps1?raw';
import lock from '../../scripts/toolchain.lock.json';

export function validateOfficialConfig(config: ConfigurationState): void {
  assertValidIdentifiers(config);
  if (!config.project || config.project.schemaVersion !== 2) throw new Error('Save or import the project to create its persistent policy identity.');
  if (config.configName.length > 80 || config.description.length > 512) throw new Error('Official authoring allows a name up to 80 characters and description up to 512.');
  if (config.version.length > 30 || config.version.split('.').some(v => Number(v) > 2147483647)) throw new Error('Version components exceed the official tool limit.');
  if (config.resources.length === 0) throw new Error('Add at least one resource.');
  const ids = new Set<string>(), names = new Set<string>(), keys = new Set<string>();
  for (const resource of config.resources) {
    const schema = schemasByName[resource.schemaName];
    if (!schema || schema.platform !== config.platform) throw new Error(`Resource ${resource.instanceName} does not match the target platform.`);
    if (ids.has(resource.id) || names.has(resource.instanceName.toLowerCase())) throw new Error('Resource IDs and instance names must be unique (names are case-insensitive).');
    ids.add(resource.id); names.add(resource.instanceName.toLowerCase());
    for (const [name, value] of Object.entries(resource.properties)) {
      if (!schema.properties.some(p => p.name === name) && value !== undefined) throw new Error(`Unknown property ${resource.instanceName}.${name}. Re-import to migrate older property names.`);
    }
    for (const prop of schema.properties) {
      const value = getPropertyValue(resource, prop);
      if (isMissingProperty(value, prop)) {
        if (prop.required || prop.isKey) throw new Error(`Required property ${resource.instanceName}.${prop.name} is empty.`);
        continue;
      }
      const valid = prop.type === 'string' ? typeof value === 'string' :
        prop.type === 'string[]' ? Array.isArray(value) && value.every(v => typeof v === 'string') :
        prop.type === 'boolean' ? typeof value === 'boolean' :
        typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 4294967295;
      if (!valid) throw new Error(`Invalid ${prop.type} value for ${resource.instanceName}.${prop.name}.`);
      if (resource.schemaName === 'ScheduledTask' && prop.name === 'ExecuteAsCredential') {
        throw new Error('ScheduledTask ExecuteAsCredential requires a credential object, not plain text. Remove it and use the resource default system account.');
      }
      if (prop.enumValues && (Array.isArray(value) ? value : [value]).some(v => !prop.enumValues!.includes(String(v)))) {
        throw new Error(`Invalid enum value for ${resource.instanceName}.${prop.name}.`);
      }
    }
    const key = `${schema.resourceName}:${JSON.stringify(schema.properties.filter(p => p.isKey).map(p => getPropertyValue(resource, p)))}`;
    if (keys.has(key)) throw new Error(`Duplicate resource keys for ${schema.resourceName}.`);
    keys.add(key);
  }
  const visited = new Set<string>(), active = new Set<string>();
  const visit = (id: string) => {
    if (active.has(id)) throw new Error('Circular DependsOn chain.');
    if (visited.has(id)) return;
    const resource = config.resources.find(r => r.id === id);
    if (!resource) throw new Error(`Unknown DependsOn resource: ${id}`);
    active.add(id); resource.dependsOn.forEach(visit); active.delete(id); visited.add(id);
  };
  config.resources.forEach(r => visit(r.id));
}

export function getOfficialProjectFiles(input: ConfigurationState): Record<string, string> {
  const config = { ...input, resources: input.resources.map(withResourceDefaults) };
  validateOfficialConfig(config);
  const releaseName = `${config.configName}_v${config.version.replaceAll('.', '_')}`;
  const dependencies = [...new Map(config.resources.map(r => {
    const schema = schemasByName[r.schemaName];
    const expected = Object.entries(lock.resources[config.platform]).find(([name]) => name === schema.moduleName)?.[1];
    if (expected !== schema.moduleVersion) throw new Error(`Resource/toolchain version mismatch for ${schema.moduleName}.`);
    return [schema.moduleName, { name: schema.moduleName, version: schema.moduleVersion }];
  })).values()];
  return {
    'config.json': JSON.stringify({ ...config, dependencies }, null, 2),
    'toolchain.lock.json': JSON.stringify(lock, null, 2),
    'Configuration.ps1': generatePs1({ ...config, configName: releaseName }),
    'McBuilder.psm1': runtime,
    'compile.ps1': compiler,
    'package.ps1': packager,
    'test.ps1': tester,
    'deploy.ps1': deployer,
    'README.md': generateOfficialReadme(config),
    '.gitignore': '.modules/\noutput/\n*.zip\n',
  };
}

export async function generateOfficialProject(config: ConfigurationState): Promise<Blob> {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(getOfficialProjectFiles(config))) zip.file(name, content);
  return zip.generateAsync({ type: 'blob' });
}

function generateOfficialReadme(config: ConfigurationState): string {
  const id = config.project!.definitionName;
  return `# ${config.configName} - official authoring preview

This is source, not a deployable Machine Configuration package. Keep config.json for importing back into the editor.
The exact same runtime is used by the browser export, repository wrappers and CI.

## 1. Build (does not configure this computer)

Use PowerShell 7.2+ on a qualified Windows or Ubuntu authoring host, not Windows PowerShell 5.1 or macOS.
Compilation of every resource is qualified in CI on its own OS; cross-OS compilation is not promised.
The lock selects GuestConfiguration 4.12.0 and PSDesiredStateConfiguration 2.0.7 (Windows) / 3.0.0-beta1 (Linux).
The isolated cache applies a hash-pinned one-line guard for an upstream 4.12.0 non-VMSS policy generation defect;
it does not rewrite generated policy JSON or change global modules.

\`\`\`powershell
pwsh ./package.ps1 -RestoreTools
\`\`\`

This explicitly restores exact modules from PSGallery into .modules (or MC_MODULE_CACHE), compiles Configuration.ps1,
and runs New-GuestConfigurationPackage. No handwritten MOF or ZIP-layout repair is used.
Never run package operations concurrently using the same module cache; the shared runtime locks it.
Do not edit generated metaconfig or policy formats. Change the source and rebuild.

## 2. Validate the exact package

Review source and resource modules first: Get/Test can execute arbitrary code.
Run on a trusted **${config.platform}** test host. Copy the complete project and output directory if testing elsewhere.
Linux evaluation needs an explicitly elevated/root shell. Windows localization errors are failures, not valid drift;
use a qualified disposable host if resource localization fails on your workstation.
The module cache is not part of the project input hash and can be restored on that host.

\`\`\`powershell
pwsh ./test.ps1 -RestoreTools -AcknowledgeExecution${config.mode === 'AuditAndSet' ? ' -Remediate -DisposableEnvironment' : ''}
\`\`\`

${config.mode === 'AuditAndSet' ? '**This modifies the test host. Use only a disposable machine.** Both remediation iterations must become compliant before publication.' : 'Noncompliance from expected drift is valid. Execution errors and missing resource results are not.'}
Validation is tied to the package hash, platform and toolchain. Editing source, metadata, runtime, or package bytes
requires rebuilding and testing again. Receipts prevent accidental stale publication; they are not security attestations.

## 3. Publish a definition (does not assign or remediate)

Provision private blob storage yourself. The publisher needs Storage Blob Data Contributor at account scope and
Resource Policy Contributor at subscription scope. No account keys are listed, roles granted, or storage accounts created.

\`\`\`powershell
pwsh ./deploy.ps1 -RestoreTools -TenantId 'Your-Tenant-ID' -SubscriptionId 'Your-Subscription-ID' -StorageAccountName 'YourStorageAccount'
\`\`\`

Publishing uploads the tested bytes, creates an HTTPS-only read SAS (6 days), runs New-GuestConfigurationPolicy,
checks its hash, and upserts definition **${id}**. Renew before expiry by rerunning deploy, not package.
Use -SkipLogin only after selecting the exact tenant/subscription. The runtime refuses a different Azure context.
Generated policy JSON contains a read credential: do not commit or publish the output directory.

## 4. Explicitly assign in a reviewed scope

\`\`\`powershell
$scope = '/subscriptions/Your-Subscription-ID/resourceGroups/Your-Test-Resource-Group'
$definition = Get-AzPolicyDefinition -Name '${id}'
$parameters = @{${config.project!.includeArc ? " IncludeArcMachines = 'true';" : ''}${config.mode === 'AuditAndSet' ? " EnableAutoRemediation = 'false';" : ''} }
${config.mode === 'AuditAndSet'
    ? `$assignment = New-AzPolicyAssignment -Name 'YourAssignmentName' -PolicyDefinition $definition -Scope $scope -Location 'Your-Region' -IdentityType SystemAssigned -PolicyParameterObject $parameters
New-AzRoleAssignment -ObjectId $assignment.Identity.PrincipalId -RoleDefinitionId '088ab73d-1256-47ae-bea9-9de8e7131f31' -Scope $scope
# Wait for identity/RBAC propagation; explicitly start first remediation for existing resources:
Start-AzPolicyRemediation -Name 'YourRemediationName' -PolicyAssignmentId $assignment.Id -Scope $scope -ResourceDiscoveryMode ReEvaluateCompliance`
    : `New-AzPolicyAssignment -Name 'YourAssignmentName' -PolicyDefinition $definition -Scope $scope -PolicyParameterObject $parameters`}
\`\`\`

VMs need the Machine Configuration extension and managed identity prerequisites.
Arc inclusion is explicit and may incur charges. VM scale sets are excluded.
GuestConfiguration 4.12.0 auto-remediation is a separate opt-in; false preserves the explicit first-remediation workflow.

## Updates and rollback

Policy identity survives export/import and refresh. New/template projects receive new identities.
Each package release uses a versioned name. Changing that name can leave an older guest assignment on a target:
review and retire old corrective assignments before explicitly deploying with -AllowReleaseUpgrade.
The runtime never deletes assignments or definitions. Keep old package bytes and policy snapshots for reviewed rollback.
Keep using the legacy export until your official workflow is validated on your target machines.

## Microsoft references

- https://learn.microsoft.com/azure/governance/machine-configuration/how-to/develop-custom-package/1-set-up-authoring-environment
- https://learn.microsoft.com/azure/governance/machine-configuration/how-to/develop-custom-package/2-create-package
- https://learn.microsoft.com/azure/governance/machine-configuration/how-to/develop-custom-package/3-test-package
- https://learn.microsoft.com/azure/governance/machine-configuration/how-to/create-policy-definition
`;
}
