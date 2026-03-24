import { ConfigurationState } from '../types';

export interface MetaconfigOutput {
  Type: string;
  configurationMode: string;
  configurationModeFrequencyMins: number;
  refreshFrequencyMins: number;
  actionAfterReboot: string;
  allowModuleOverwrite: boolean;
  rebootIfNeeded: boolean;
  category: string;
  customPackageSettings: boolean;
  preferPowerShellModule: boolean;
  solutionType: string;
  executionPolicy: {
    complianceStatus: boolean;
    displayId: string;
    execute: boolean;
    reasons: unknown[];
  };
}

/** Generate metaconfig.json content
 *
 * The GC agent on the machine expects a FULL metaconfig — not just the Type field.
 * A minimal metaconfig (just Type + configurationModeFrequencyMins) causes the agent
 * to reject remediation packages with "does not support remediation".
 *
 * Validated on Azure VM (mc-linux-5084, 2026-03-23):
 *  - Audit: Type="Audit", configurationMode="MonitorOnly"
 *  - AuditAndSet: Type="AuditAndSet", configurationMode="ApplyAndAutoCorrect"
 *
 * The GC agent enriches minimal metaconfigs, but for reliable cross-version
 * compatibility we emit the full set of required fields.
 */
export function generateMetaconfig(config: ConfigurationState): MetaconfigOutput {
  const isRemediation = config.mode === 'AuditAndSet';

  return {
    Type: isRemediation ? 'AuditAndSet' : 'Audit',
    configurationMode: isRemediation ? 'ApplyAndAutoCorrect' : 'MonitorOnly',
    configurationModeFrequencyMins: 15,
    refreshFrequencyMins: 5,
    actionAfterReboot: 'ContinueConfiguration',
    allowModuleOverwrite: false,
    rebootIfNeeded: false,
    category: 'Policy',
    customPackageSettings: true,
    preferPowerShellModule: false,
    solutionType: 'custom_inguest',
    executionPolicy: {
      complianceStatus: true,
      displayId: '',
      execute: true,
      reasons: [],
    },
  };
}

/** Generate metaconfig.json as a formatted string */
export function generateMetaconfigString(config: ConfigurationState): string {
  return JSON.stringify(generateMetaconfig(config), null, 2);
}

/** Get the metaconfig filename */
export function getMetaconfigFilename(configName: string): string {
  return `${configName}.metaconfig.json`;
}
