import type { ConfigurationState } from '../types';
import { schemasByName } from '../schemas';
import { assertValidIdentifiers, getPropertyValue, isMissingProperty } from './configuration';

export const GC_UNSUPPORTED_CLASSES = new Set([
  'MSFT_WindowsOptionalFeature', 'MSFT_WindowsPackageCab', 'MSFT_ArchiveResource',
  'MSFT_RoleResource', 'MSFT_GroupResource',
]);

export function validateConfig(config: ConfigurationState): string[] {
  assertValidIdentifiers(config);
  for (const resource of config.resources) {
    const schema = schemasByName[resource.schemaName];
    if (!schema) throw new Error(`Unknown schema "${resource.schemaName}" in resource "${resource.instanceName}"`);
    if (GC_UNSUPPORTED_CLASSES.has(schema.mofClassName)) {
      throw new Error(`Resource "${resource.instanceName}" uses ${schema.mofClassName} (${resource.schemaName}) which is NOT supported in the Azure Guest Configuration agent sandbox. Remove it or use an alternative resource.`);
    }
    for (const prop of schema.properties) {
      const value = getPropertyValue(resource, prop);
      if ((prop.required || prop.isKey) && isMissingProperty(value, prop)) {
        throw new Error(`Required property "${prop.name}" is missing for resource "[${schema.resourceName}]${resource.instanceName}". This will cause a DSC runtime error on the target VM.`);
      }
      if (prop.enumValues && value !== undefined && value !== null && value !== '') {
        for (const part of Array.isArray(value) ? value.map(String) : [String(value)]) {
          if (!prop.enumValues.includes(part)) {
            throw new Error(`Invalid value "${part}" for property "${prop.name}" in resource "[${schema.resourceName}]${resource.instanceName}". Valid values: ${prop.enumValues.join(', ')}`);
          }
        }
      }
    }
  }
  return [];
}
