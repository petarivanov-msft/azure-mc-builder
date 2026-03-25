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

/** Build the configurationParameter ARM expression for parameterized policies.
 *  Returns an array of { name, value } objects referencing ARM parameters. */
function buildConfigurationParameters(config: ConfigurationState): Array<{ name: string; value: string }> {
  const params: Array<{ name: string; value: string }> = [];
  for (const resource of config.resources) {
    // For each property that has a value, it could be wired as a policy parameter.
    // The convention is: [ResourceType]InstanceName;PropertyName
    // We emit them as static values in the template; policy-level parameterization
    // is handled by the caller replacing {{param:...}} placeholders.
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

/** Build the parameterHash existenceCondition fragment.
 *  Microsoft built-in policies use base64-encoded concatenation of all parameter
 *  name=value pairs to detect when policy parameters change and force redeployment.
 *  For policies with no configurationParameters, this is omitted. */
function buildExistenceCondition(configParams: Array<{ name: string; value: string }>): object {
  if (configParams.length === 0) {
    return {
      allOf: [
        {
          field: 'Microsoft.GuestConfiguration/guestConfigurationAssignments/complianceStatus',
          equals: 'Compliant',
        },
      ],
    };
  }

  // Build the base64 concat expression for parameterHash matching
  const paramParts = configParams.map(p => `${p.name}=${p.value}`).join(',');

  return {
    allOf: [
      {
        field: 'Microsoft.GuestConfiguration/guestConfigurationAssignments/complianceStatus',
        equals: 'Compliant',
      },
      {
        field: 'Microsoft.GuestConfiguration/guestConfigurationAssignments/parameterHash',
        equals: `{{parameterHash:${paramParts}}}`,
      },
    ],
  };
}

/** Generate DeployIfNotExists policy 'then' block for AuditAndSet (remediation) mode */
function generateDeployThen(config: ConfigurationState): object {
  const isWindows = config.platform === 'Windows';
  const extensionType = isWindows ? 'ConfigurationforWindows' : 'ConfigurationforLinux';
  const extensionName = isWindows ? 'AzurePolicyforWindows' : 'AzurePolicyforLinux';
  const assignmentType = 'ApplyAndAutoCorrect';
  const configParams = buildConfigurationParameters(config);

  return {
    effect: 'deployIfNotExists',
    details: {
      type: 'Microsoft.GuestConfiguration/guestConfigurationAssignments',
      name: config.configName,
      roleDefinitionIds: [
        '/providers/microsoft.authorization/roleDefinitions/b24988ac-6180-42a0-ab88-20f7382dd24c',
      ],
      existenceCondition: buildExistenceCondition(configParams),
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
                apiVersion: '2024-04-05',
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
                    configurationParameter: configParams.length > 0 ? configParams : [],
                  },
                },
              },
              {
                apiVersion: '2024-03-01',
                type: 'Microsoft.Compute/virtualMachines',
                identity: {
                  type: 'SystemAssigned',
                },
                name: "[parameters('vmName')]",
                location: "[parameters('location')]",
              },
              {
                apiVersion: '2024-03-01',
                name: `[concat(parameters('vmName'), '/${extensionName}')]`,
                type: 'Microsoft.Compute/virtualMachines/extensions',
                location: "[parameters('location')]",
                properties: {
                  publisher: 'Microsoft.GuestConfiguration',
                  type: extensionType,
                  typeHandlerVersion: '1.*',
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
