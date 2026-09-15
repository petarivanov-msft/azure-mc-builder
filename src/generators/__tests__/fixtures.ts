import type { ConfigMode, ConfigurationState } from '../../types';
import { schemasByName } from '../../schemas';
import { createProjectSettings, getConditionalRequiredProperties } from '../../utils/configuration';

export function schemaConfig(schemaName: string, mode: ConfigMode = 'Audit'): ConfigurationState {
  const schema = schemasByName[schemaName];
  if (!schema) throw new Error(`Unknown schema: ${schemaName}`);
  const properties: Record<string, unknown> = {};
  for (const prop of schema.properties) {
    if (prop.defaultValue !== undefined) properties[prop.name] = structuredClone(prop.defaultValue);
    else if (prop.required || prop.isKey) {
      const value = prop.enumValues?.[0] ?? prop.placeholder ?? `Test${prop.name}`;
      properties[prop.name] = prop.type === 'string[]' ? [value] :
        prop.type === 'boolean' ? true : prop.type === 'integer' ? 1 : value;
    }
  }
  const resource = { id: schemaName, schemaName, instanceName: `Test${schemaName}`, properties, dependsOn: [] };
  for (const field of getConditionalRequiredProperties(resource, mode)) {
    properties[field] = field === 'Mode' ? '0644' : 'root';
  }
  return { configName: `Test_${schemaName}`, platform: schema.platform, mode, version: '1.0.0',
    description: '', project: createProjectSettings(), resources: [resource] };
}
