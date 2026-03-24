import { ConfigurationState } from '../types';

/** Generate the shared 'if' condition for policy rules (VM + Arc OS type filtering) */
function generateIfCondition(isWindows: boolean): object {
  const osTypeFilter = isWindows ? 'Windows*' : 'Linux*';
  const osProfileField = isWindows ? 'windowsConfiguration' : 'linuxConfiguration';

  return {
    anyOf: [
      {
        allOf: [
          {
            field: 'type',
            equals: 'Microsoft.Compute/virtualMachines',
          },
          {
            anyOf: [
              {
                field: 'Microsoft.Compute/virtualMachines/storageProfile.osDisk.osType',
                like: osTypeFilter,
              },
              {
                field: `Microsoft.Compute/virtualMachines/osProfile.${osProfileField}`,
                exists: 'true',
              },
            ],
          },
        ],
      },
      {
        allOf: [
          {
            field: 'type',
            equals: 'Microsoft.HybridCompute/machines',
          },
          {
            field: 'Microsoft.HybridCompute/machines/osName',
            like: osTypeFilter,
          },
        ],
      },
    ],
  };
}

/** Generate AuditIfNotExists policy 'then' block */
function generateAuditThen(configName: string): object {
  return {
    effect: 'auditIfNotExists',
    details: {
      type: 'Microsoft.GuestConfiguration/guestConfigurationAssignments',
      name: configName,
      existenceCondition: {
        allOf: [
          {
            field: 'Microsoft.GuestConfiguration/guestConfigurationAssignments/complianceStatus',
            equals: 'Compliant',
          },
        ],
      },
    },
  };
}

/** Generate DeployIfNotExists policy 'then' block for AuditAndSet (remediation) mode */
function generateDeployThen(config: ConfigurationState): object {
  const isWindows = config.platform === 'Windows';
  const extensionType = isWindows ? 'ConfigurationforWindows' : 'ConfigurationforLinux';
  const extensionName = isWindows ? 'AzurePolicyforWindows' : 'AzurePolicyforLinux';
  const assignmentType = 'ApplyAndAutoCorrect';

  return {
    effect: 'deployIfNotExists',
    details: {
      type: 'Microsoft.GuestConfiguration/guestConfigurationAssignments',
      name: config.configName,
      roleDefinitionIds: [
        '/providers/microsoft.authorization/roleDefinitions/b24988ac-6180-42a0-ab88-20f7382dd24c',
      ],
      existenceCondition: {
        allOf: [
          {
            field: 'Microsoft.GuestConfiguration/guestConfigurationAssignments/complianceStatus',
            equals: 'Compliant',
          },
        ],
      },
      deployment: {
        properties: {
          mode: 'incremental',
          parameters: {
            vmName: {
              value: "[field('name')]",
            },
            location: {
              value: "[field('location')]",
            },
            configurationName: {
              value: config.configName,
            },
            contentUri: {
              value: '{{contentUri}}',
            },
            contentHash: {
              value: '{{contentHash}}',
            },
          },
          template: {
            $schema: 'https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#',
            contentVersion: '1.0.0.0',
            parameters: {
              vmName: { type: 'string' },
              location: { type: 'string' },
              configurationName: { type: 'string' },
              contentUri: { type: 'string' },
              contentHash: { type: 'string' },
            },
            resources: [
              {
                apiVersion: '2020-06-25',
                type: 'Microsoft.Compute/virtualMachines/providers/guestConfigurationAssignments',
                name: "[concat(parameters('vmName'), '/Microsoft.GuestConfiguration/', parameters('configurationName'))]",
                location: "[parameters('location')]",
                properties: {
                  guestConfiguration: {
                    name: "[parameters('configurationName')]",
                    version: config.version,
                    contentUri: "[parameters('contentUri')]",
                    contentHash: "[parameters('contentHash')]",
                    assignmentType: assignmentType,
                    configurationParameter: [],
                  },
                },
              },
              {
                apiVersion: '2017-03-30',
                type: 'Microsoft.Compute/virtualMachines',
                identity: {
                  type: 'SystemAssigned',
                },
                name: "[parameters('vmName')]",
                location: "[parameters('location')]",
              },
              {
                apiVersion: '2015-05-01-preview',
                name: `[concat(parameters('vmName'), '/${extensionName}')]`,
                type: 'Microsoft.Compute/virtualMachines/extensions',
                location: "[parameters('location')]",
                properties: {
                  publisher: 'Microsoft.GuestConfiguration',
                  type: extensionType,
                  typeHandlerVersion: '1.0',
                  autoUpgradeMinorVersion: true,
                },
                dependsOn: [
                  "[concat('Microsoft.Compute/virtualMachines/',parameters('vmName'),'/providers/Microsoft.GuestConfiguration/guestConfigurationAssignments/',parameters('configurationName'))]",
                ],
              },
            ],
          },
        },
      },
    },
  };
}

/** Generate Azure Policy JSON for Machine Configuration (AuditIfNotExists or DeployIfNotExists) */
export function generatePolicyJson(config: ConfigurationState): object {
  const isWindows = config.platform === 'Windows';
  const isRemediation = config.mode === 'AuditAndSet';
  const effectLabel = isRemediation ? 'DeployIfNotExists' : 'AuditIfNotExists';

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
