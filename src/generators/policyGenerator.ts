import { ConfigurationState } from '../types';

/**
 * Generate Azure Policy JSON for Machine Configuration.
 * Output matches New-GuestConfigurationPolicy cmdlet structure:
 *   - Audit mode → AuditIfNotExists (MC service creates GC assignment via metadata)
 *   - AuditAndSet mode → DeployIfNotExists (DINE deploys GC assignment)
 *
 * Key: metadata.guestConfiguration must contain contentUri/contentHash —
 * the MC service uses this to create GC assignments for both AINE and DINE policies.
 */

/** Generate the 'if' condition — filters for VMs and Arc machines by OS type */
function generateIfCondition(isWindows: boolean): object {
  const osTypeFilter = isWindows ? 'Windows*' : 'Linux*';
  const osProfileField = isWindows ? 'windowsConfiguration' : 'linuxConfiguration';

  return {
    anyOf: [
      {
        allOf: [
          { field: 'type', equals: 'Microsoft.Compute/virtualMachines' },
          {
            anyOf: [
              { field: 'Microsoft.Compute/virtualMachines/storageProfile.osDisk.osType', like: osTypeFilter },
              { field: `Microsoft.Compute/virtualMachines/osProfile.${osProfileField}`, exists: 'true' },
            ],
          },
        ],
      },
      {
        allOf: [
          { field: 'type', equals: 'Microsoft.HybridCompute/machines' },
          { field: 'Microsoft.HybridCompute/machines/osName', like: osTypeFilter },
        ],
      },
    ],
  };
}

/** Generate AuditIfNotExists 'then' block (matches New-GuestConfigurationPolicy -Mode Audit) */
function generateAuditThen(configName: string): object {
  return {
    effect: 'auditIfNotExists',
    details: {
      type: 'Microsoft.GuestConfiguration/guestConfigurationAssignments',
      name: configName,
      existenceCondition: {
        field: 'Microsoft.GuestConfiguration/guestConfigurationAssignments/complianceStatus',
        equals: 'Compliant',
      },
    },
  };
}

/** Build configurationParameter array from resource properties */
function buildConfigurationParameters(config: ConfigurationState): Array<{ name: string; value: string }> {
  const params: Array<{ name: string; value: string }> = [];
  for (const resource of config.resources) {
    for (const [propName, propValue] of Object.entries(resource.properties)) {
      if (propValue !== undefined && propValue !== null && propValue !== '') {
        params.push({
          name: `[${resource.schemaName}]${resource.instanceName};${propName}`,
          value: String(propValue),
        });
      }
    }
  }
  return params;
}

/** Generate DeployIfNotExists 'then' block (matches New-GuestConfigurationPolicy -Mode ApplyAndAutoCorrect) */
function generateDeployThen(config: ConfigurationState): object {
  const configParams = buildConfigurationParameters(config);

  // Guest Configuration Resource Contributor — matches MS cmdlet output (least privilege)
  const gcResourceContributorRole = '/providers/Microsoft.Authorization/roleDefinitions/088ab73d-1256-47ae-bea9-9de8e7131f31';

  const gcAssignmentProperties = {
    guestConfiguration: {
      name: "[parameters('configurationName')]",
      version: config.version,
      contentUri: "[parameters('contentUri')]",
      contentHash: "[parameters('contentHash')]",
      assignmentType: 'ApplyAndAutoCorrect',
      configurationParameter: configParams.length > 0 ? configParams : [],
    },
  };

  return {
    effect: 'deployIfNotExists',
    details: {
      type: 'Microsoft.GuestConfiguration/guestConfigurationAssignments',
      name: config.configName,
      roleDefinitionIds: [gcResourceContributorRole],
      existenceCondition: {
        field: 'Microsoft.GuestConfiguration/guestConfigurationAssignments/complianceStatus',
        equals: 'Compliant',
      },
      deployment: {
        properties: {
          mode: 'incremental',
          parameters: {
            vmName: { value: "[field('name')]" },
            location: { value: "[field('location')]" },
            type: { value: "[field('type')]" },
            configurationName: { value: config.configName },
            contentUri: { value: '{{contentUri}}' },
            contentHash: { value: '{{contentHash}}' },
          },
          template: {
            $schema: 'https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#',
            contentVersion: '1.0.0.0',
            parameters: {
              vmName: { type: 'string' },
              location: { type: 'string' },
              type: { type: 'string' },
              configurationName: { type: 'string' },
              contentUri: { type: 'string' },
              contentHash: { type: 'string' },
            },
            resources: [
              // Azure VM GC assignment
              {
                apiVersion: '2024-04-05',
                type: 'Microsoft.Compute/virtualMachines/providers/guestConfigurationAssignments',
                name: "[concat(parameters('vmName'), '/Microsoft.GuestConfiguration/', parameters('configurationName'))]",
                location: "[parameters('location')]",
                condition: "[equals(toLower(parameters('type')), toLower('Microsoft.Compute/virtualMachines'))]",
                properties: gcAssignmentProperties,
              },
              // Arc machine GC assignment
              {
                apiVersion: '2024-04-05',
                type: 'Microsoft.HybridCompute/machines/providers/guestConfigurationAssignments',
                name: "[concat(parameters('vmName'), '/Microsoft.GuestConfiguration/', parameters('configurationName'))]",
                location: "[parameters('location')]",
                condition: "[equals(toLower(parameters('type')), toLower('Microsoft.HybridCompute/machines'))]",
                properties: gcAssignmentProperties,
              },
              // VMSS GC assignment
              {
                apiVersion: '2024-04-05',
                type: 'Microsoft.Compute/virtualMachineScaleSets/providers/guestConfigurationAssignments',
                name: "[concat(parameters('vmName'), '/Microsoft.GuestConfiguration/', parameters('configurationName'))]",
                location: "[parameters('location')]",
                condition: "[equals(toLower(parameters('type')), toLower('Microsoft.Compute/virtualMachineScaleSets'))]",
                properties: gcAssignmentProperties,
              },
            ],
          },
        },
      },
    },
  };
}

/** Generate Azure Policy JSON for Machine Configuration */
export function generatePolicyJson(config: ConfigurationState): object {
  const isWindows = config.platform === 'Windows';
  const isRemediation = config.mode === 'AuditAndSet';

  return {
    properties: {
      displayName: `[MC] ${config.configName}`,
      policyType: 'Custom',
      mode: 'Indexed',
      description: config.description || `Machine Configuration policy for ${config.configName}`,
      metadata: {
        version: config.version,
        category: 'Guest Configuration',
        guestConfiguration: {
          name: config.configName,
          version: config.version,
          contentType: 'Custom',
          contentUri: '{{contentUri}}',
          contentHash: '{{contentHash}}',
          configurationParameter: {},
        },
      },
      parameters: {},
      policyRule: {
        if: generateIfCondition(isWindows),
        then: isRemediation
          ? generateDeployThen(config)
          : generateAuditThen(config.configName),
      },
    },
  };
}

/** Generate policy JSON as formatted string */
export function generatePolicyJsonString(config: ConfigurationState): string {
  return JSON.stringify(generatePolicyJson(config), null, 2);
}
