import { ConfigurationState } from '../types';

/** Generate AuditIfNotExists Azure Policy JSON for Machine Configuration */
export function generatePolicyJson(config: ConfigurationState): object {
  const isWindows = config.platform === 'Windows';
  const osTypeFilter = isWindows ? 'Windows*' : 'Linux*';
  const osProfileField = isWindows ? 'windowsConfiguration' : 'linuxConfiguration';

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
        if: {
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
        },
        then: {
          effect: 'auditIfNotExists',
          details: {
            type: 'Microsoft.GuestConfiguration/guestConfigurationAssignments',
            name: config.configName,
            existenceCondition: {
              allOf: [
                {
                  field: 'Microsoft.GuestConfiguration/guestConfigurationAssignments/complianceStatus',
                  equals: 'Compliant',
                },
              ],
            },
          },
        },
      },
    },
  };
}

/** Generate policy JSON as formatted string */
export function generatePolicyJsonString(config: ConfigurationState): string {
  return JSON.stringify(generatePolicyJson(config), null, 2);
}
